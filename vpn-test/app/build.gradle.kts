plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android { namespace = "com.spidergram.vpntest"; compileSdk = 36
    defaultConfig { applicationId = "com.spidergram.vpntest"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "0.1.0" }
}
