package org.duckdns.wavcloud

import androidx.media3.common.Player
import org.json.JSONArray
import org.json.JSONObject

class PlayerStateDispatcher(private val javascript: JavascriptGateway) {
    fun dispatchState(player: Player) {
        val queue = JSONArray()
        for (index in 0 until player.mediaItemCount) {
            val item = player.getMediaItemAt(index)
            val metadata = item.mediaMetadata
            queue.put(
                JSONObject()
                    .put("id", item.mediaId)
                    .put("title", metadata.title?.toString() ?: "Unknown title")
                    .put("artist", metadata.artist?.toString() ?: "Unknown artist")
                    .put("album", metadata.albumTitle?.toString() ?: "WavCloud")
                    .put("artworkUri", metadata.artworkUri?.toString() ?: "")
            )
        }
        javascript.invoke(
            "__wavcloudNativeState",
            commonState(player).put("volume", player.volume.toDouble()).put("queue", queue)
        )
    }

    fun dispatchProgress(player: Player) {
        javascript.invoke("__wavcloudNativeProgress", commonState(player))
    }

    fun dispatchError(message: String) {
        javascript.invoke("__wavcloudNativeError", message)
    }

    private fun commonState(player: Player): JSONObject = JSONObject()
        .put("trackId", player.currentMediaItem?.mediaId ?: "")
        .put("isPlaying", player.isPlaying)
        .put("isLoading", player.playbackState == Player.STATE_BUFFERING)
        .put("currentTime", player.currentPosition.coerceAtLeast(0) / 1000.0)
        .put("duration", player.duration.coerceAtLeast(0) / 1000.0)
}
