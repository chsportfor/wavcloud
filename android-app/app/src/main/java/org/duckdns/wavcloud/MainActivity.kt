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
import android.webkit.WebChromeClient
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
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private val nativeBridge = NativePlayerBridge()
    private lateinit var artworkResolverBridge: ArtworkResolverBridge
    private lateinit var javascriptGateway: JavascriptGateway
    private lateinit var playerStateDispatcher: PlayerStateDispatcher
    private val handler = Handler(Looper.getMainLooper())

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
        webView = WebView(this).apply {
            setBackgroundColor(0xFF090C12.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webChromeClient = WebChromeClient()
            webViewClient = WavCloudWebViewClient()
            addJavascriptInterface(nativeBridge, "WavCloudAndroid")
        }
        artworkResolverBridge = ArtworkResolverBridge(webView, this)
        javascriptGateway = JavascriptGateway(webView)
        playerStateDispatcher = PlayerStateDispatcher(javascriptGateway)
        webView.addJavascriptInterface(artworkResolverBridge, "WavCloudArtwork")
        setContentView(webView)

        val html = assets.open("app.html").bufferedReader().use { it.readText() }
        webView.loadDataWithBaseURL(
            "https://wavcloud.duckdns.org/",
            html,
            "text/html",
            "UTF-8",
            "https://wavcloud.duckdns.org/"
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    stopPlaybackAndExit()
                }
            }
        })

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onStart() {
        super.onStart()
        if (controller == null && controllerFuture == null) connectController()
        handler.removeCallbacks(stateTicker)
        handler.post(stateTicker)
    }

    private fun connectController() {
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync().also { future ->
            future.addListener({
                controller = future.get().also { mediaController ->
                    nativeBridge.attachPlayer(mediaController)
                    mediaController.addListener(object : Player.Listener {
                        override fun onEvents(player: Player, events: Player.Events) = dispatchPlayerState()
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
        artworkResolverBridge.shutdown()
        javascriptGateway.close()
        nativeBridge.attachPlayer(null)
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
        controller?.run {
            stop()
            clearMediaItems()
        }
        stopService(Intent(this, PlaybackService::class.java))
        finishAndRemoveTask()
    }

    private inner class WavCloudWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (uri.scheme == "https" && uri.host.equals("wavcloud.duckdns.org", ignoreCase = true)) {
                return false
            }
            if (request.isForMainFrame) {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    .onFailure { Log.w("WavCloudNavigation", "Unable to open $uri", it) }
            }
            return true
        }
    }
}
