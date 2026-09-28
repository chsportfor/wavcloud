package org.duckdns.wavcloud

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import org.json.JSONArray

class NativePlayerBridge {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var player: Player? = null
    private val pendingActions = ArrayDeque<(Player) -> Unit>()

    fun attachPlayer(value: Player?) {
        mainHandler.post {
            player = value
            if (value != null) {
                while (pendingActions.isNotEmpty()) pendingActions.removeFirst()(value)
            }
        }
    }

    private fun withPlayer(action: (Player) -> Unit) {
        mainHandler.post {
            player?.let(action) ?: pendingActions.addLast(action)
        }
    }

    @JavascriptInterface
    fun setQueue(queueJson: String, currentTrackId: String, playWhenReady: Boolean) {
        val items = parseItems(queueJson)
        if (items.isEmpty()) return
        withPlayer { player ->
            val index = items.indexOfFirst { it.mediaId == currentTrackId }.coerceAtLeast(0)
            player.setMediaItems(items, index, 0L)
            player.prepare()
            player.playWhenReady = playWhenReady
        }
    }

    @JavascriptInterface
    fun syncQueue(queueJson: String) {
        val items = parseItems(queueJson)
        withPlayer { player ->
            val currentIds = (0 until player.mediaItemCount).map { player.getMediaItemAt(it).mediaId }
            val desiredIds = items.map { it.mediaId }
            for (operation in QueueUpdatePlanner.plan(currentIds, desiredIds)) {
                when (operation) {
                    is QueueOperation.Insert -> player.addMediaItem(operation.index, items[operation.index])
                    is QueueOperation.Move -> player.moveMediaItem(operation.from, operation.to)
                    is QueueOperation.Remove -> player.removeMediaItem(operation.index)
                }
            }
        }
    }

    @JavascriptInterface fun play() = withPlayer { it.play() }
    @JavascriptInterface fun pause() = withPlayer { it.pause() }
    @JavascriptInterface fun stop() = withPlayer { it.stop() }
    @JavascriptInterface fun seekTo(seconds: Double) = withPlayer { it.seekTo((seconds * 1000).toLong()) }
    @JavascriptInterface fun setVolume(value: Double) = withPlayer { it.volume = value.toFloat().coerceIn(0f, 1f) }
    @JavascriptInterface fun setShuffle(enabled: Boolean) = withPlayer { it.shuffleModeEnabled = enabled }

    @JavascriptInterface
    fun getSpectrum(): String = JSONArray(SpectrumStore.bands.toList()).toString()

    @JavascriptInterface
    fun setRepeat(mode: String) {
        withPlayer { player ->
            player.repeatMode = when (mode) {
                "one" -> Player.REPEAT_MODE_ONE
                "all" -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
        }
    }

    private fun parseItems(json: String): List<MediaItem> {
        val values = JSONArray(json)
        return buildList {
            for (index in 0 until values.length()) {
                val track = values.getJSONObject(index)
                val metadata = MediaMetadata.Builder()
                    .setTitle(track.optString("title", "Unknown title"))
                    .setArtist(track.optString("artist", "Unknown artist"))
                    .setAlbumTitle(track.optString("album", "WavCloud"))
                    .apply {
                        track.optString("artworkUri").takeIf { it.isNotBlank() }?.let {
                            setArtworkUri(Uri.parse(it))
                        }
                    }
                    .build()
                add(
                    MediaItem.Builder()
                        .setMediaId(track.getString("id"))
                        .setUri(track.getString("streamUri"))
                        .setMediaMetadata(metadata)
                        .build()
                )
            }
        }
    }
}
