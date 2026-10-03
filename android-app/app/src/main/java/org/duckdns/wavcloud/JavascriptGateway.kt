package org.duckdns.wavcloud

import android.webkit.WebView
import org.json.JSONObject

class JavascriptGateway(private val webView: WebView) {
    @Volatile
    private var active = true

    fun invoke(callback: String, payload: JSONObject) {
        val encodedPayload = JSONObject.quote(payload.toString())
        webView.post {
            if (active) webView.evaluateJavascript("window.$callback?.($encodedPayload)", null)
        }
    }

    fun invoke(callback: String, value: String) {
        val encodedValue = JSONObject.quote(value)
        webView.post {
            if (active) webView.evaluateJavascript("window.$callback?.($encodedValue)", null)
        }
    }

    fun invokeArgs(callback: String, vararg values: String) {
        val arguments = values.joinToString(",") { JSONObject.quote(it) }
        webView.post {
            if (active) webView.evaluateJavascript("window.$callback?.($arguments)", null)
        }
    }

    fun close() {
        active = false
    }
}
