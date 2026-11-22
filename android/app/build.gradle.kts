import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val rawAppUrl = (project.findProperty("APP_URL") as? String)?.trim()?.takeIf { it.isNotEmpty() }
    ?: System.getenv("NETFLUX_APP_URL")?.trim()?.takeIf { it.isNotEmpty() }
    ?: "https://ais-pre-euj3wxuef7xp3b57twk4en-706784507558.europe-west2.run.app"
val escapedAppUrl = rawAppUrl.replace("\\", "\\\\").replace("\"", "\\\"")
val ciRunNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")?.trim()?.takeIf { it.isNotEmpty() }
val keystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val keyAliasValue = System.getenv("ANDROID_KEY_ALIAS")
val keyPasswordValue = System.getenv("ANDROID_KEY_PASSWORD")
val hasReleaseKeystore = !keystorePath.isNullOrEmpty() &&
    File(keystorePath).exists() &&
    !keystorePassword.isNullOrEmpty() &&
    !keyAliasValue.isNullOrEmpty() &&
    !keyPasswordValue.isNullOrEmpty()

android {
    namespace = "com.netflux.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.netflux.app"
        minSdk = 24
        targetSdk = 35
        versionCode = ciRunNumber
        versionName = "1.0.$ciRunNumber"

        buildConfigField("String", "APP_URL", "\"$escapedAppUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = File(keystorePath!!)
                storePassword = keystorePassword
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
}
