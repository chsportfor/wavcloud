package org.duckdns.wavcloud

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.ListenableFuture

@UnstableApi
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var bundledHtml: String
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private lateinit var nativeBridge: NativePlayerBridge
    private lateinit var offlineBridge: NativeOfflineBridge
    private lateinit var offlineAudioStore: OfflineAudioStore
    private lateinit var artworkResolverBridge: ArtworkResolverBridge
    private lateinit var javascriptGateway: JavascriptGateway
    private lateinit var playerStateDispatcher: PlayerStateDispatcher
    private lateinit var fileChooserBridge: FileChooserBridge
    private val handler = Handler(Looper.getMainLooper())
    private var controllerRetryCount = 0
    private val controllerRetry = Runnable { connectController() }

    private val stateTicker = object : Runnable {
        override fun run() {
            dispatchPlayerProgress()
            handler.postDelayed(this, 500)
        }
    }

    private val notificationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) showNotificationPermissionGuidance()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        offlineAudioStore = OfflineAudioStore(this)
        nativeBridge = NativePlayerBridge(offlineAudioStore) { dispatchPlayerState() }
        fileChooserBridge = FileChooserBridge(this)
        webView = WebView(this).apply {
            setBackgroundColor(0xFF090C12.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = fileChooserBridge
            webViewClient = WavCloudWebViewClient()
            addJavascriptInterface(nativeBridge, "WavCloudAndroid")
        }
        javascriptGateway = JavascriptGateway(webView)
        artworkResolverBridge = ArtworkResolverBridge(javascriptGateway, this)
        offlineBridge = NativeOfflineBridge(offlineAudioStore, javascriptGateway)
        playerStateDispatcher = PlayerStateDispatcher(javascriptGateway)
        webView.addJavascriptInterface(artworkResolverBridge, "WavCloudArtwork")
        webView.addJavascriptInterface(offlineBridge, "WavCloudOffline")
        setContentView(webView)

        bundledHtml = assets.open("app.html").bufferedReader().use { it.readText() }
        loadBundledPage()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    """(() => { const dialogs = [...document.querySelectorAll('dialog[open]')];
                        const dialog = dialogs[dialogs.length - 1];
                        if (!dialog) return false; dialog.close(); return true; })()"""
                ) { closed ->
                    if (closed != "true") {
                        if (webView.canGoBack()) webView.goBack() else stopPlaybackAndExit()
                    }
                }
            }
        })

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun loadBundledPage() {
        webView.loadDataWithBaseURL(
            "https://wavcloud.duckdns.org/",
            bundledHtml,
            "text/html",
            "UTF-8",
            "https://wavcloud.duckdns.org/"
        )
    }

    override fun onStart() {
        super.onStart()
        if (controller == null && controllerFuture == null) connectController()
        handler.removeCallbacks(stateTicker)
        handler.post(stateTicker)
    }

    private fun connectController() {
        if (controller != null || controllerFuture != null || isDestroyed) return
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync().also { future ->
            future.addListener({
                if (controllerFuture !== future || isDestroyed) return@addListener
                val mediaController = runCatching { future.get() }.getOrElse { error ->
                    Log.e("WavCloudPlayback", "MediaController connection failed", error)
                    controllerFuture = null
                    dispatchPlayerError("플레이어에 연결하지 못했습니다.")
                    if (controllerRetryCount++ < 2) handler.postDelayed(controllerRetry, 1_500)
                    return@addListener
                }
                controllerRetryCount = 0
                controller = mediaController.also {
                    nativeBridge.attachPlayer(mediaController)
                    mediaController.addListener(object : Player.Listener {
                        override fun onEvents(player: Player, events: Player.Events) {
                            playerStateDispatcher.dispatchState(
                                player,
                                events.contains(Player.EVENT_TIMELINE_CHANGED) ||
                                    events.contains(Player.EVENT_MEDIA_METADATA_CHANGED)
                            )
                        }
                        override fun onPlayerError(error: PlaybackException) {
                            Log.e("WavCloudPlayback", "${error.errorCodeName}: ${error.message}", error)
                            val cause = error.cause
                            val detail = buildString {
                                append(error.errorCodeName)
                                cause?.javaClass?.simpleName?.let { append(" · ").append(it) }
                                cause?.message?.takeIf { it.isNotBlank() }?.let { append(": ").append(it.take(120)) }
                            }
                            dispatchPlayerError(detail)
                        }
                    })
                    dispatchPlayerState()
                }
            }, ContextCompat.getMainExecutor(this))
        }
    }

    override fun onStop() {
        handler.removeCallbacks(stateTicker)
        super.onStop()
    }

    override fun onDestroy() {
        fileChooserBridge.close()
        handler.removeCallbacks(controllerRetry)
        handler.removeCallbacks(stateTicker)
        artworkResolverBridge.shutdown()
        offlineBridge.shutdown()
        javascriptGateway.close()
        nativeBridge.close()
        controllerFuture?.let(MediaController::releaseFuture)
        controllerFuture = null
        controller = null
        super.onDestroy()
    }

    private fun dispatchPlayerState() {
        val player = controller ?: return
        playerStateDispatcher.dispatchState(player)
    }

    private fun dispatchPlayerProgress() {
        val player = controller ?: return
        playerStateDispatcher.dispatchProgress(player)
    }

    private fun dispatchPlayerError(message: String) {
        playerStateDispatcher.dispatchError(message)
    }

    private fun showNotificationPermissionGuidance() {
        android.app.AlertDialog.Builder(this)
            .setTitle("재생 컨트롤 알림")
            .setMessage("알림 권한을 허용하면 잠금 화면과 알림창에서 음악을 제어할 수 있습니다.")
            .setNegativeButton("나중에", null)
            .setPositiveButton("설정 열기") { _, _ ->
                startActivity(
                    Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                )
            }
            .show()
    }

    private fun stopPlaybackAndExit() {
        controller?.pause()
        stopService(Intent(this, PlaybackService::class.java))
        finishAndRemoveTask()
    }

    private inner class WavCloudWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (request.isForMainFrame) {
                if (uri.scheme == "https" && uri.host.equals("wavcloud.duckdns.org", true) &&
                    uri.path == "/" && uri.query == null
                ) {
                    loadBundledPage()
                    return true
                }
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    .onFailure { Log.w("WavCloudNavigation", "Unable to open $uri", it) }
            }
            return true
        }
    }
}
