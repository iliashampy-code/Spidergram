package com.spidergram.vpntest

import android.content.Context
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config

object SpiderVpnController {
    private const val TUNNEL_NAME = "SpiderGram"
    private var backend: GoBackend? = null

    @Volatile
    var isConnected: Boolean = false
        private set

    private val tunnel = object : Tunnel {
        override fun getName(): String = TUNNEL_NAME

        override fun onStateChange(newState: Tunnel.State) {
            isConnected = newState == Tunnel.State.UP
        }
    }

    fun connect(context: Context): Boolean {
        return try {
            val b = backend ?: GoBackend(context.applicationContext).also { backend = it }
            val config = context.resources.openRawResource(R.raw.spidergram).use { input ->
                Config.parse(input)
            }
            val state = b.setState(tunnel, Tunnel.State.UP, config)
            isConnected = state == Tunnel.State.UP
            isConnected
        } catch (_: Exception) {
            isConnected = false
            false
        }
    }

    fun disconnect() {
        try {
            backend?.setState(tunnel, Tunnel.State.DOWN, null)
        } catch (_: Exception) {
            // Keep UI state consistent even if the backend is already down.
        } finally {
            isConnected = false
        }
    }
}
