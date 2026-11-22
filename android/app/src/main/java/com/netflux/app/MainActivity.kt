package com.netflux.app

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    companion object {
        private const val LOCAL_HOST = "localhost"
        private const val LOCAL_START_URL = "https://localhost/"
        private const val CHROME_UA =
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    }

    private lateinit var rootContainer: FrameLayout
    private lateinit var webView: WebView
    private lateinit var localApi: NetfluxLocalApi
    private val bridgeExecutor = Executors.newCachedThreadPool()

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private inner class NetfluxBridge {
        @JavascriptInterface
        fun retry() {
            webView.post {
                webView.loadUrl(LOCAL_START_URL)
            }
        }

        @JavascriptInterface
        fun apiRequestAsync(
            reqId: String,
            pathAndQuery: String,
            method: String,
            headersJson: String,
            body: String
        ) {
            bridgeExecutor.execute {
                val res = localApi.handleBridgeRequest(pathAndQuery, method, headersJson, body)
                val js = "window.__netfluxResolveNativeApi && window.__netfluxResolveNativeApi(" +
                    "${JSONObject.quote(reqId)}, ${res.status}, ${JSONObject.quote(res.body)});"
                webView.post {
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(js, null)
                    }
                }
            }
        }
    }

    private val backCallback = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            if (customView != null) {
                hideFullscreenVideo()
            } else if (::webView.isInitialized && webView.canGoBack()) {
                webView.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        localApi = NetfluxLocalApi(applicationContext)

        WindowCompat.setDecorFitsSystemWindows(window, true)
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.BLACK
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.BLACK

        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        rootContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        rootContainer.addView(webView)
        setContentView(rootContainer)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = userAgentString.replace("; wv", "")
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(NetfluxBridge(), "NetfluxBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                if (!uri.scheme.equals("https", true) || !uri.host.equals(LOCAL_HOST, true)) {
                    return null
                }

                val path = uri.path ?: "/"
                if (path.startsWith("/api/")) {
                    return localApi.handleGetOrHeadIntercept(
                        uri = uri,
                        method = request.method ?: "GET",
                        requestHeaders = request.requestHeaders ?: emptyMap()
                    )
                }

                return serveBundledAsset(path)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase(Locale.US) ?: return false
                val host = uri.host?.lowercase(Locale.US) ?: ""
                val openExternally = scheme in setOf(
                    "whatsapp",
                    "mailto",
                    "tel",
                    "sms",
                    "intent",
                    "market"
                ) || host.contains("chat.whatsapp.com") || host == "wa.me"

                if (openExternally) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    } catch (_: Exception) {
                        // External handler unavailable
                    }
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                val uri = request?.url
                if (
                    request?.isForMainFrame == true &&
                    uri?.scheme != "file" &&
                    !uri?.host.equals(LOCAL_HOST, true) &&
                    error?.errorCode != ERROR_ABORTED
                ) {
                    view?.loadUrl("file:///android_asset/offline.html")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (view == null) return
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                webView.visibility = View.GONE
                rootContainer.addView(
                    view,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.hide(WindowInsetsCompat.Type.systemBars())
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }

            override fun onHideCustomView() {
                hideFullscreenVideo()
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                if (url.startsWith("blob:", ignoreCase = true)) {
                    return@setDownloadListener
                }
                val parsedUri = Uri.parse(url)
                val effectiveUrl: String
                val effectiveFileName: String

                if (parsedUri.host.equals(LOCAL_HOST, true) && parsedUri.path == "/api/stream") {
                    effectiveUrl = localApi.sanitizeStreamUrl(parsedUri.getQueryParameter("url")) ?: return@setDownloadListener
                    effectiveFileName = parsedUri.getQueryParameter("filename")
                        ?.takeIf { it.isNotBlank() }
                        ?: URLUtil.guessFileName(effectiveUrl, contentDisposition, mimeType)
                } else {
                    effectiveUrl = url
                    effectiveFileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                }

                if (
                    effectiveUrl.startsWith("http://", ignoreCase = true) ||
                    effectiveUrl.startsWith("https://", ignoreCase = true)
                ) {
                    val request = DownloadManager.Request(Uri.parse(effectiveUrl))
                    val cookies = CookieManager.getInstance().getCookie(effectiveUrl)
                    if (!cookies.isNullOrBlank()) {
                        request.addRequestHeader("Cookie", cookies)
                    }
                    request.addRequestHeader(
                        "User-Agent",
                        userAgent?.takeIf { it.isNotBlank() } ?: CHROME_UA
                    )
                    request.setMimeType(mimeType?.takeIf { it.isNotBlank() } ?: "video/mp4")
                    request.setTitle(effectiveFileName)
                    request.setDescription("Downloading with Netflux")
                    request.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        effectiveFileName
                    )
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(effectiveUrl)))
                }
            } catch (_: Exception) {
                try {
                    if (!url.startsWith("blob:", ignoreCase = true)) {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                } catch (_: Exception) {
                    // Ignore unsupported download URLs
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, backCallback)
        webView.loadUrl(LOCAL_START_URL)
    }

    private fun serveBundledAsset(rawPath: String): WebResourceResponse {
        val cleanPath = rawPath.trimStart('/')
            .split('/')
            .filter { it.isNotEmpty() && it != "." && it != ".." }
            .joinToString("/")

        val assetPath = if (cleanPath.isEmpty()) "www/index.html" else "www/$cleanPath"
        val stream = runCatching { assets.open(assetPath) }.getOrNull()
        if (stream != null) {
            val mime = guessMimeType(assetPath)
            val cacheHeader = if (assetPath.contains("assets/")) {
                "public, max-age=31536000, immutable"
            } else {
                "no-store"
            }
            return WebResourceResponse(
                mime,
                if (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("xml")) "utf-8" else null,
                200,
                "OK",
                mapOf(
                    "Cache-Control" to cacheHeader,
                    "Access-Control-Allow-Origin" to "*"
                ),
                stream
            )
        }

        // Static asset extensions that genuinely don't exist should return 404
        val lower = cleanPath.lowercase(Locale.US)
        val hasStaticExtension = Regex("\\.(js|mjs|css|map|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|json|webmanifest)$")
            .containsMatchIn(lower)
        if (hasStaticExtension) {
            return WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                mapOf("Cache-Control" to "no-store"),
                ByteArrayInputStream(ByteArray(0))
            )
        }

        // SPA fallback to index.html for app routes
        val indexStream = runCatching { assets.open("www/index.html") }.getOrNull()
        if (indexStream != null) {
            return WebResourceResponse(
                "text/html",
                "utf-8",
                200,
                "OK",
                mapOf("Cache-Control" to "no-store"),
                indexStream
            )
        }

        return WebResourceResponse(
            "text/html",
            "utf-8",
            404,
            "Not Found",
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream("<h1>Netflux web bundle missing</h1>".toByteArray(Charsets.UTF_8))
        )
    }

    private fun guessMimeType(assetPath: String): String {
        val lower = assetPath.lowercase(Locale.US)
        return when {
            lower.endsWith(".html") -> "text/html"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".webmanifest") -> "application/manifest+json"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".webp") -> "image/webp"
            lower.endsWith(".gif") -> "image/gif"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".ico") -> "image/x-icon"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".woff") -> "font/woff"
            lower.endsWith(".ttf") -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun hideFullscreenVideo() {
        val view = customView ?: return
        rootContainer.removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        webView.visibility = View.VISIBLE
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.show(WindowInsetsCompat.Type.systemBars())
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
            CookieManager.getInstance().flush()
        }
        super.onPause()
    }

    override fun onDestroy() {
        localApi.shutdown()
        bridgeExecutor.shutdownNow()
        if (::webView.isInitialized) {
            rootContainer.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }
}
