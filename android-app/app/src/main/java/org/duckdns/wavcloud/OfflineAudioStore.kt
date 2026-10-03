package org.duckdns.wavcloud

import android.content.Context
import android.net.Uri
import android.util.Base64
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

/** Audio files used by Media3. WebView's Cache API is not visible to the player. */
class OfflineAudioStore(context: Context) {
    private val directory = File(context.filesDir, "offline-audio").apply { mkdirs() }
    private var importId: String? = null
    private var importFile: File? = null
    private var importStream: FileOutputStream? = null
    private var importedBytes = 0L

    fun isCached(trackId: String): Boolean = fileFor(trackId).let { it.isFile && it.length() > 0 }

    fun mediaUri(trackId: String, streamUri: String): Uri =
        if (isCached(trackId)) Uri.fromFile(fileFor(trackId)) else Uri.parse(streamUri)

    fun remove(trackId: String): Boolean = fileFor(trackId).let { !it.exists() || it.delete() }

    @Synchronized
    fun beginImport(trackId: String) {
        require(trackId.isNotBlank()) { "Missing track ID" }
        check(importId == null) { "Another audio import is in progress" }
        val temporary = File(directory, "${fileFor(trackId).name}.import")
        importStream = temporary.outputStream()
        importFile = temporary
        importId = trackId
        importedBytes = 0
    }

    @Synchronized
    fun appendImport(trackId: String, base64: String) {
        check(importId == trackId) { "No active import" }
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        check(importedBytes + bytes.size <= MAX_IMPORT_BYTES) { "Audio file is too large" }
        importStream!!.write(bytes)
        importedBytes += bytes.size
    }

    @Synchronized
    fun finishImport(trackId: String) {
        check(importId == trackId && importedBytes > 0) { "Incomplete audio import" }
        val temporary = importFile!!
        importStream!!.close()
        importStream = null
        val destination = fileFor(trackId)
        if (!isCached(trackId)) {
            Files.move(temporary.toPath(), destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        }
        abortImport()
    }

    @Synchronized
    fun abortImport() {
        importStream?.close()
        importStream = null
        importFile?.delete()
        importFile = null
        importId = null
        importedBytes = 0
    }

    fun download(trackId: String, streamUri: String) {
        require(trackId.isNotBlank()) { "Missing track ID" }
        val uri = Uri.parse(streamUri)
        require(uri.scheme == "https" && uri.host.equals("wavcloud.duckdns.org", true) &&
            uri.pathSegments.size == 3 && uri.pathSegments[0] == "api" &&
            uri.pathSegments[1] == "stream" && uri.pathSegments[2] == trackId
        ) { "Invalid stream URL" }
        if (isCached(trackId)) return

        val destination = fileFor(trackId)
        val temporary = File(directory, "${destination.name}.tmp")
        val connection = URL(streamUri).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 30_000
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                error("Download failed: HTTP ${connection.responseCode}")
            }
            val expectedBytes = connection.contentLengthLong
            check(expectedBytes <= MAX_IMPORT_BYTES) { "Audio file is too large" }
            var downloadedBytes = 0L
            connection.inputStream.use { input ->
                temporary.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        if (Thread.currentThread().isInterrupted) throw IOException("Download cancelled")
                        val count = input.read(buffer)
                        if (count < 0) break
                        downloadedBytes += count
                        check(downloadedBytes <= MAX_IMPORT_BYTES) { "Audio file is too large" }
                        output.write(buffer, 0, count)
                    }
                }
            }
            check(downloadedBytes > 0) { "Downloaded audio is empty" }
            check(expectedBytes < 0 || downloadedBytes == expectedBytes) { "Audio download is incomplete" }
            if (isCached(trackId)) return
            Files.move(temporary.toPath(), destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            connection.disconnect()
            temporary.delete()
        }
    }

    private fun fileFor(trackId: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(trackId.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return File(directory, "$digest.audio")
    }

    companion object {
        private const val MAX_IMPORT_BYTES = 1024L * 1024 * 1024
    }
}
