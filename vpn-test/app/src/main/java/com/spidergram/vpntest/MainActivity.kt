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
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32,80,32,32) }
        val title = TextView(this).apply { text = "SpiderGram"; textSize = 30f }
        status = TextView(this).apply { text = "⚪ Отключено"; textSize = 18f; setPadding(0,12,0,24) }
        val button = Button(this).apply { text = "Подключить" }
        button.setOnClickListener {
            val intent = VpnService.prepare(this)
            if (intent != null) startActivityForResult(intent, 100) else startVpn()
        }
        root.addView(title); root.addView(status); root.addView(button)
        setContentView(root)
    }
    private fun startVpn() {
        startService(Intent(this, SpiderVpnService::class.java))
        status.text = "🟡 Подключение…"
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 100 && resultCode == RESULT_OK) startVpn()
        else if (requestCode == 100) status.text = "⚪ Отключено"
    }
}
