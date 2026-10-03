package org.duckdns.wavcloud

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioOffloadSupport
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

@UnstableApi
class PlaybackService : MediaSessionService() {
    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var spectrumSink: SpectrumBufferSink? = null
    private lateinit var queueStore: PlaybackQueueStore
    private val handler = Handler(Looper.getMainLooper())
    private val positionSaver = object : Runnable {
        override fun run() {
            player?.takeIf { it.isPlaying }?.let { queueStore.save(it) }
            handler.postDelayed(this, 5_000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this)
                .setChannelId("wavcloud_playback")
                .setChannelName(R.string.playback_channel_name)
                .setNotificationId(2109)
                .build()
        )
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        val sink = SpectrumBufferSink().also { spectrumSink = it }
        val processor = TeeAudioProcessor(sink)
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildAudioSink(
                context: Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean
            ): AudioSink? {
                val audioSink = DefaultAudioSink.Builder(context)
                    .setEnableFloatOutput(enableFloatOutput)
                    .setEnableAudioOutputPlaybackParameters(enableAudioTrackPlaybackParams)
                    .setAudioProcessors(arrayOf(processor))
                    .setAudioOffloadSupportProvider { _, _ ->
                        AudioOffloadSupport.DEFAULT_UNSUPPORTED
                    }
                    .build()
                audioSink.setOffloadMode(AudioSink.OFFLOAD_MODE_DISABLED)
                return audioSink
            }
        }

        queueStore = PlaybackQueueStore(this, OfflineAudioStore(this))
        player = ExoPlayer.Builder(this, renderersFactory).build().also { exoPlayer ->
            exoPlayer.setAudioAttributes(audioAttributes, true)
            exoPlayer.setHandleAudioBecomingNoisy(true)
            val sessionActivity = PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            mediaSession = MediaSession.Builder(this, exoPlayer)
                .setSessionActivity(sessionActivity)
                .build()
            queueStore.restore(exoPlayer)
            exoPlayer.addListener(object : Player.Listener {
                override fun onEvents(player: Player, events: Player.Events) {
                    val queueChanged = events.contains(Player.EVENT_TIMELINE_CHANGED) ||
                        events.contains(Player.EVENT_MEDIA_METADATA_CHANGED)
                    queueStore.save(player, includeQueue = queueChanged)
                }
            })
        }
        handler.post(positionSaver)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onTaskRemoved(rootIntent: Intent?) {
        player?.run {
            pause()
            queueStore.save(this, includeQueue = true, synchronous = true)
        }
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        handler.removeCallbacks(positionSaver)
        player?.takeIf { it.mediaItemCount > 0 }?.let {
            queueStore.save(it, includeQueue = true, synchronous = true)
        }
        spectrumSink?.release()
        spectrumSink = null
        mediaSession?.release()
        mediaSession = null
        player?.release()
        player = null
        super.onDestroy()
    }
}
