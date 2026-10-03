package org.duckdns.wavcloud

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import org.json.JSONArray
import org.json.JSONObject

/** Persists the Media3 queue independently of the WebView and the service process. */
class PlaybackQueueStore(context: Context, private val offlineAudio: OfflineAudioStore) {
    private val queuePreferences: SharedPreferences =
        context.getSharedPreferences("playback_queue", Context.MODE_PRIVATE)
    private val statePreferences: SharedPreferences =
        context.getSharedPreferences("playback_state", Context.MODE_PRIVATE)

    fun save(player: Player, includeQueue: Boolean = false, synchronous: Boolean = false) {
        if (includeQueue || player.mediaItemCount == 0) {
            val editor = queuePreferences.edit()
            if (player.mediaItemCount == 0) {
                editor.remove(KEY_QUEUE)
            } else {
                val items = JSONArray()
                for (index in 0 until player.mediaItemCount) {
                    val item = player.getMediaItemAt(index)
                    val metadata = item.mediaMetadata
                    items.put(JSONObject()
                        .put("id", item.mediaId)
                        .put("uri", item.localConfiguration?.uri?.toString() ?: "")
                        .put("streamUri", metadata.extras?.getString(STREAM_URI_KEY) ?: "")
                        .put("title", metadata.title?.toString() ?: "")
                        .put("artist", metadata.artist?.toString() ?: "")
                        .put("album", metadata.albumTitle?.toString() ?: "")
                        .put("artworkUri", metadata.artworkUri?.toString() ?: ""))
                }
                editor.putString(KEY_QUEUE, JSONObject().put("version", 1).put("items", items).toString())
            }
            if (synchronous) editor.commit() else editor.apply()
        }
        val editor = statePreferences.edit()
        editor.putInt(KEY_INDEX, player.currentMediaItemIndex.coerceAtLeast(0))
            .putLong(KEY_POSITION, player.currentPosition.coerceAtLeast(0L))
            .putInt(KEY_REPEAT, player.repeatMode)
            .putBoolean(KEY_SHUFFLE, player.shuffleModeEnabled)
        if (synchronous) editor.commit() else editor.apply()
    }

    fun restore(player: Player) {
        val saved = queuePreferences.getString(KEY_QUEUE, null) ?: return
        try {
            val snapshot = JSONObject(saved)
            if (snapshot.optInt("version") != 1) return
            val values = snapshot.getJSONArray("items")
            if (values.length() !in 1..MAX_QUEUE_SIZE) return
            val items = mutableListOf<MediaItem>()
            for (index in 0 until values.length()) {
                val value = values.getJSONObject(index)
                val id = value.getString("id")
                val savedUri = value.optString("uri")
                val streamUri = value.optString("streamUri")
                if (id.isBlank() || (savedUri.isBlank() && streamUri.isBlank())) return
                val uri = when {
                    streamUri.isNotBlank() -> offlineAudio.mediaUri(id, streamUri)
                    else -> Uri.parse(savedUri)
                }
                val metadata = MediaMetadata.Builder()
                    .setTitle(value.optString("title", "Unknown title"))
                    .setArtist(value.optString("artist", "Unknown artist"))
                    .setAlbumTitle(value.optString("album", "WavCloud"))
                    .setExtras(Bundle().apply { putString(STREAM_URI_KEY, streamUri) })
                    .apply {
                        value.optString("artworkUri").takeIf { it.isNotBlank() }?.let {
                            setArtworkUri(Uri.parse(it))
                        }
                    }
                    .build()
                items.add(MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata).build())
            }
            val index = statePreferences.getInt(KEY_INDEX, 0).coerceIn(items.indices)
            val position = statePreferences.getLong(KEY_POSITION, 0L).coerceAtLeast(0L)
            player.setMediaItems(items, index, position)
            player.repeatMode = statePreferences.getInt(KEY_REPEAT, Player.REPEAT_MODE_OFF)
                .takeIf { it in Player.REPEAT_MODE_OFF..Player.REPEAT_MODE_ALL } ?: Player.REPEAT_MODE_OFF
            player.shuffleModeEnabled = statePreferences.getBoolean(KEY_SHUFFLE, false)
            // Restoring a killed process should never start audio without a user action.
            player.playWhenReady = false
            player.prepare()
        } catch (_: Exception) {
            queuePreferences.edit().remove(KEY_QUEUE).apply()
        }
    }

    companion object {
        const val STREAM_URI_KEY = "wavcloud.streamUri"
        private const val KEY_QUEUE = "queue"
        private const val KEY_INDEX = "index"
        private const val KEY_POSITION = "position"
        private const val KEY_REPEAT = "repeat"
        private const val KEY_SHUFFLE = "shuffle"
        private const val MAX_QUEUE_SIZE = 5000
    }
}
