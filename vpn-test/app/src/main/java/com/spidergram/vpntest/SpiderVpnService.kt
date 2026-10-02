package com.spidergram.vpntest

import android.net.VpnService
import android.os.ParcelFileDescriptor

class SpiderVpnService : VpnService() {
    private var vpnInterface: ParcelFileDescriptor? = null
    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        vpnInterface?.close()
        vpnInterface = Builder()
            .setSession("SpiderGram")
            .addAddress("10.8.0.2", 32)
            .addRoute("10.8.0.1", 32)
            .establish()
        return START_STICKY
    }
    override fun onDestroy() {
        vpnInterface?.close(); vpnInterface = null; super.onDestroy()
    }
}
