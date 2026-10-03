package org.duckdns.wavcloud

import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

/** Connect HTML file inputs to Android's picker, including cancellation. */
class FileChooserBridge(activity: ComponentActivity) : WebChromeClient() {
    private var pending: ValueCallback<Array<Uri>>? = null
    private val picker = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pending
        pending = null
        callback?.onReceiveValue(FileChooserParams.parseResult(result.resultCode, result.data))
    }

    override fun onShowFileChooser(
        webView: WebView?,
        callback: ValueCallback<Array<Uri>>?,
        params: FileChooserParams?
    ): Boolean {
        pending?.onReceiveValue(null)
        pending = callback
        try {
            val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "audio/*"
                addCategory(Intent.CATEGORY_OPENABLE)
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            picker.launch(intent)
        } catch (_: Exception) {
            close()
        }
        return true
    }

    fun close() {
        val callback = pending
        pending = null
        callback?.onReceiveValue(null)
    }
}
