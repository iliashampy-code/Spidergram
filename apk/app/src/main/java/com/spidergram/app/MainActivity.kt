package com.spidergram.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    companion object {
        private const val SITE_URL = "https://spidergram-production.up.railway.app"
        private const val FILE_REQUEST = 1001
        private const val PERMISSION_REQUEST = 1002
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        setupWebView()
        webView.loadUrl(SITE_URL)
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                Toast.makeText(this@MainActivity, "SpiderGram перезапускается…", Toast.LENGTH_SHORT).show()
                runOnUiThread {
                    try {
                        val parent = view.parent as? android.view.ViewGroup
                        parent?.removeView(view)
                        view.destroy()
                        webView = WebView(this@MainActivity)
                        setContentView(webView)
                        setupWebView()
                        webView.loadUrl(SITE_URL)
                    } catch (_: Exception) {
                        finish()
                    }
                }
                return true
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith("http://") || url.startsWith("https://")) {
                    view.loadUrl(url)
                    true
                } else {
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (_: Exception) { }
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(params.createIntent(), FILE_REQUEST)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }
        }
    }

    private fun requestMediaPermissions() {
        val needed = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isNotEmpty()) ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
    }

    override fun onResume() {
        super.onResume()
        // Do not force a reload here: Android can call onResume after permission/file dialogs.
        // The live site is loaded on launch, so website updates are still picked up next time the app opens.
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_REQUEST) {
            val results = if (resultCode == Activity.RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else null
            fileCallback?.onReceiveValue(results)
            fileCallback = null
        }
    }

    override fun onDestroy() {
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }
}
