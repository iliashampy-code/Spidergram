package com.spidergram.vpntest

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var button: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 80, 32, 32)
        }

        val title = TextView(this).apply {
            text = "SpiderGram"
            textSize = 30f
        }

        status = TextView(this).apply {
            text = "⚪ Отключено"
            textSize = 18f
            setPadding(0, 12, 0, 24)
        }

        button = Button(this).apply {
            text = "Подключить"
            setOnClickListener { toggleVpn() }
        }

        root.addView(title)
        root.addView(status)
        root.addView(button)
        setContentView(root)
    }

    private fun toggleVpn() {
        if (SpiderVpnController.isConnected) {
            SpiderVpnController.disconnect()
            render(false)
            return
        }

        val permissionIntent = VpnService.prepare(this)
        if (permissionIntent != null) {
            status.text = "🟡 Подключение…"
            startActivityForResult(permissionIntent, REQUEST_VPN)
        } else {
            connectVpn()
        }
    }

    private fun connectVpn() {
        status.text = "🟡 Подключение…"
        button.isEnabled = false
        Thread {
            val ok = SpiderVpnController.connect(this)
            runOnUiThread {
                button.isEnabled = true
                if (ok) {
                    status.text = "🟢 Подключено"
                    button.text = "Отключить"
                } else {
                    status.text = "🔴 Не удалось подключиться"
                    button.text = "Подключить"
                }
            }
        }.start()
    }

    private fun render(connected: Boolean) {
        status.text = if (connected) "🟢 Подключено" else "⚪ Отключено"
        button.text = if (connected) "Отключить" else "Подключить"
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_VPN) return

        if (resultCode == RESULT_OK) connectVpn()
        else render(false)
    }

    companion object {
        private const val REQUEST_VPN = 100
    }
}
