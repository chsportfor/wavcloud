package org.duckdns.wavcloud

import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.util.concurrent.Executors

class NativeOfflineBridge(
    private val store: OfflineAudioStore,
    private val javascript: JavascriptGateway
) {
    private val executor = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun isCached(trackId: String): Boolean = store.isCached(trackId)

    @JavascriptInterface
    fun remove(trackId: String): Boolean = store.remove(trackId)

    @JavascriptInterface
    fun beginImport(trackId: String): Boolean = runCatching { store.beginImport(trackId) }.isSuccess

    @JavascriptInterface
    fun appendImport(trackId: String, base64: String): Boolean =
        runCatching { store.appendImport(trackId, base64) }.isSuccess

    @JavascriptInterface
    fun finishImport(trackId: String): Boolean = runCatching { store.finishImport(trackId) }.isSuccess

    @JavascriptInterface
    fun abortImport() = store.abortImport()

    @JavascriptInterface
    fun download(requestId: String, trackId: String, streamUri: String) {
        if (requestId.length > 128) return
        runCatching {
            executor.execute {
                val error = runCatching { store.download(trackId, streamUri) }
                    .exceptionOrNull()?.message.orEmpty()
                javascript.invoke(
                    "__wavcloudOfflineResult",
                    JSONObject().put("requestId", requestId).put("error", error)
                )
            }
        }.onFailure {
            javascript.invoke(
                "__wavcloudOfflineResult",
                JSONObject().put("requestId", requestId).put("error", "Download unavailable")
            )
        }
    }

    fun shutdown() {
        executor.shutdownNow()
        store.abortImport()
    }
}
