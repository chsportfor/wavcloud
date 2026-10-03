package org.duckdns.wavcloud

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Bundle
import android.webkit.JavascriptInterface
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import org.json.JSONArray

class NativePlayerBridge(
    private val offlineAudio: OfflineAudioStore,
    private val onStateRequested: () -> Unit
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var player: Player? = null
    private val pendingActions = ArrayDeque<(Player) -> Unit>()
    @Volatile private var closed = false

    fun attachPlayer(value: Player?) {
        mainHandler.post {
            if (closed) return@post
            player = value
            if (value != null) {
                while (pendingActions.isNotEmpty()) pendingActions.removeFirst()(value)
            }
        }
    }

    fun close() {
        closed = true
        mainHandler.post {
            player = null
            pendingActions.clear()
        }
    }

    private fun withPlayer(action: (Player) -> Unit) {
        mainHandler.post {
            if (closed) return@post
            player?.let(action) ?: run {
                if (pendingActions.size >= 64) pendingActions.removeFirst()
                pendingActions.addLast(action)
            }
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
            for (index in items.indices) {
                if (player.getMediaItemAt(index) != items[index]) {
                    player.replaceMediaItem(index, items[index])
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
    fun requestState() {
        mainHandler.post { if (!closed) onStateRequested() }
    }

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
                    .setExtras(Bundle().apply {
                        putString(PlaybackQueueStore.STREAM_URI_KEY, track.optString("streamUri"))
                    })
                    .apply {
                        track.optString("artworkUri").takeIf { it.isNotBlank() }?.let {
                            setArtworkUri(Uri.parse(it))
                        }
                    }
                    .build()
                add(
                    MediaItem.Builder()
                        .setMediaId(track.getString("id"))
                        .setUri(offlineAudio.mediaUri(track.getString("id"), track.getString("streamUri")))
                        .setMediaMetadata(metadata)
                        .build()
                )
            }
        }
    }
}
