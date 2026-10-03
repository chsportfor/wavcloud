import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.duckdns.wavcloud"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.duckdns.wavcloud"
        minSdk = 26
        targetSdk = 36
        versionCode = 33
        versionName = "0.1.32"
    }

    signingConfigs {
        getByName("debug") {
            val existingKey = file("debug.keystore")
            if (existingKey.exists()) {
                storeFile = existingKey
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    val bundledJunit = gradle.gradleHomeDir?.resolve("lib/junit-4.13.2.jar")
    if (bundledJunit?.exists() == true) {
        testImplementation(files(bundledJunit, bundledJunit.parentFile.resolve("hamcrest-core-1.3.jar")))
    } else {
        testImplementation("junit:junit:4.13.2")
    }
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-session:1.11.1")
}
