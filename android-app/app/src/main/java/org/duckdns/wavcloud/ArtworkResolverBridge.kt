package org.duckdns.wavcloud

import android.content.Context
import android.os.SystemClock
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.Normalizer
import java.util.concurrent.Executors

class ArtworkResolverBridge(
    private val javascript: JavascriptGateway,
    context: Context
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val preferences = context.getSharedPreferences("wavcloud_hq_artwork_v2", Context.MODE_PRIVATE)
    private var lastMusicBrainzRequestAt = 0L

    @JavascriptInterface
    fun resolve(requestId: String, album: String, artist: String) {
        val normalizedAlbum = normalize(album)
        val normalizedArtist = normalize(artist)
        if (normalizedAlbum.isBlank() || normalizedArtist.isBlank() || isUnknown(artist)) {
            callback(requestId, "")
            return
        }

        val cacheKey = "$normalizedArtist::$normalizedAlbum"
        if (preferences.contains(cacheKey)) {
            callback(requestId, preferences.getString(cacheKey, "").orEmpty())
            return
        }

        runCatching {
            executor.execute {
                javascript.invokeArgs("__wavcloudArtworkStarted", requestId)
                val artworkUrl = runCatching {
                    findArtwork(album.trim(), artist.trim(), normalizedAlbum, normalizedArtist)
                }.getOrNull().orEmpty()
                if (artworkUrl.isNotBlank()) preferences.edit().putString(cacheKey, artworkUrl).apply()
                callback(requestId, artworkUrl)
            }
        }.onFailure { callback(requestId, "") }
    }

    fun shutdown() {
        executor.shutdownNow()
    }

    private fun findArtwork(
        album: String,
        artist: String,
        normalizedAlbum: String,
        normalizedArtist: String
    ): String? {
        val elapsed = SystemClock.elapsedRealtime() - lastMusicBrainzRequestAt
        if (elapsed < MUSICBRAINZ_INTERVAL_MS) Thread.sleep(MUSICBRAINZ_INTERVAL_MS - elapsed)

        val query = "releasegroup:\"$album\" AND artist:\"$artist\""
        val endpoint = "https://musicbrainz.org/ws/2/release-group/?query=" +
            URLEncoder.encode(query, Charsets.UTF_8.name()) + "&fmt=json&limit=5"
        lastMusicBrainzRequestAt = SystemClock.elapsedRealtime()
        val response = requestJson(endpoint) ?: return null
        val groups = response.optJSONArray("release-groups") ?: return null

        for (index in 0 until groups.length()) {
            val group = groups.optJSONObject(index) ?: continue
            if (group.optInt("score", 0) < 90) continue
            val resultAlbum = normalize(group.optString("title"))
            if (resultAlbum != normalizedAlbum) continue

            val credits = group.optJSONArray("artist-credit")
            val resultArtist = buildString {
                if (credits != null) {
                    for (creditIndex in 0 until credits.length()) {
                        val credit = credits.optJSONObject(creditIndex) ?: continue
                        append(credit.optString("name"))
                    }
                }
            }.let(::normalize)
            if (resultArtist.isBlank() || resultArtist != normalizedArtist) continue

            val id = group.optString("id")
            if (id.isBlank()) continue
            val coverUrl = "https://coverartarchive.org/release-group/$id/front-1200"
            if (coverExists(coverUrl)) return coverUrl
        }
        return null
    }

    private fun requestJson(url: String): JSONObject? {
        val connection = URL(url).openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 7_000
            connection.readTimeout = 9_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", USER_AGENT)
            if (connection.responseCode !in 200..299) return null
            connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
        } finally {
            connection.disconnect()
        }
    }

    private fun coverExists(url: String): Boolean {
        val connection = URL(url).openConnection() as HttpURLConnection
        return try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = "HEAD"
            connection.connectTimeout = 7_000
            connection.readTimeout = 9_000
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.responseCode in 200..399
        } finally {
            connection.disconnect()
        }
    }

    private fun callback(requestId: String, url: String) {
        javascript.invokeArgs("__wavcloudArtworkResolved", requestId, url)
    }

    private fun normalize(value: String): String = Normalizer
        .normalize(value, Normalizer.Form.NFKC)
        .lowercase()
        .replace(Regex("[^\\p{L}\\p{N}]+"), "")

    private fun isUnknown(value: String): Boolean {
        val normalized = normalize(value)
        return normalized.isBlank() || normalized in setOf("unknownartist", "아티스트미상", "unknown")
    }

    companion object {
        private const val MUSICBRAINZ_INTERVAL_MS = 1_100L
        private const val USER_AGENT = "WavCloud/0.1.29 (https://wavcloud.duckdns.org)"
    }
}
