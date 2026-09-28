package org.duckdns.wavcloud

import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.*

object SpectrumStore {
    @Volatile var bands: IntArray = IntArray(64)
}

@UnstableApi
class SpectrumBufferSink : TeeAudioProcessor.AudioBufferSink {
    private val rawSamples = DoubleArray(1024)
    private val window = DoubleArray(1024) { .5 - .5 * cos(2 * PI * it / 1023) }
    private var writePos = 0
    private var currentSampleRate = 44100
    private var channelCount = 2
    private var currentEncoding = C.ENCODING_PCM_16BIT
    private var coefficients = DoubleArray(64)
    private val smoothedBands = IntArray(64)
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "SpectrumAnalyzer").apply { isDaemon = true }
    }
    private val isAnalyzing = AtomicBoolean(false)
    private val bufferLock = Any()

    init {
        updateCoefficients(44100)
    }

    private fun updateCoefficients(sampleRate: Int) {
        val safeRate = if (sampleRate > 0) sampleRate else 44100
        val upper = min(16000.0, safeRate * .45)
        coefficients = DoubleArray(64) { band ->
            val hz = 50.0 * (upper / 50.0).pow(band / 63.0)
            2 * cos(2 * PI * hz / safeRate)
        }
    }

    override fun flush(sampleRate: Int, channelCount: Int, encoding: Int) {
        this.currentSampleRate = if (sampleRate > 0) sampleRate else 44100
        this.channelCount = if (channelCount > 0) channelCount else 2
        this.currentEncoding = if (encoding != C.ENCODING_INVALID) encoding else C.ENCODING_PCM_16BIT
        updateCoefficients(currentSampleRate)
        synchronized(bufferLock) {
            rawSamples.fill(0.0)
            writePos = 0
        }
        smoothedBands.fill(0)
        SpectrumStore.bands = IntArray(64)
    }

    override fun handleBuffer(buffer: ByteBuffer) {
        if (!buffer.hasRemaining()) return
        val channels = if (channelCount > 0) channelCount else 2
        val encoding = currentEncoding

        try {
            val pcm = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
            when (encoding) {
                C.ENCODING_PCM_16BIT -> {
                    val shorts = pcm.asShortBuffer()
                    val frames = shorts.remaining() / channels
                    if (frames > 0) {
                        val count = min(frames, 1024)
                        synchronized(bufferLock) {
                            for (i in 0 until count) {
                                var sample = shorts.get().toDouble() / 32768.0
                                if (channels > 1) {
                                    val right = shorts.get().toDouble() / 32768.0
                                    sample = (sample + right) * 0.5
                                    for (c in 2 until channels) shorts.get()
                                }
                                rawSamples[writePos] = sample.coerceIn(-1.0, 1.0)
                                writePos = (writePos + 1) and 1023
                            }
                        }
                    }
                }
                C.ENCODING_PCM_FLOAT -> {
                    val floats = pcm.asFloatBuffer()
                    val frames = floats.remaining() / channels
                    if (frames > 0) {
                        val count = min(frames, 1024)
                        synchronized(bufferLock) {
                            for (i in 0 until count) {
                                var sample = floats.get().toDouble()
                                if (channels > 1) {
                                    val right = floats.get().toDouble()
                                    sample = (sample + right) * 0.5
                                    for (c in 2 until channels) floats.get()
                                }
                                rawSamples[writePos] = sample.coerceIn(-1.0, 1.0)
                                writePos = (writePos + 1) and 1023
                            }
                        }
                    }
                }
                else -> {
                    // 24비트, 32비트 또는 기타 PCM 인코딩 지원
                    val bytesRemaining = pcm.remaining()
                    val bytesPerSample = when (encoding) {
                        C.ENCODING_PCM_24BIT -> 3
                        C.ENCODING_PCM_32BIT -> 4
                        else -> 2
                    }
                    val frameSize = bytesPerSample * channels
                    val frames = bytesRemaining / frameSize
                    if (frames > 0) {
                        val count = min(frames, 1024)
                        synchronized(bufferLock) {
                            for (i in 0 until count) {
                                var sample = when (bytesPerSample) {
                                    3 -> {
                                        val b0 = pcm.get().toInt() and 0xFF
                                        val b1 = pcm.get().toInt() and 0xFF
                                        val b2 = pcm.get().toInt()
                                        ((b2 shl 16) or (b1 shl 8) or b0).toDouble() / 8388608.0
                                    }
                                    4 -> pcm.getInt().toDouble() / 2147483648.0
                                    else -> pcm.getShort().toDouble() / 32768.0
                                }
                                if (channels > 1) {
                                    val right = when (bytesPerSample) {
                                        3 -> {
                                            val b0 = pcm.get().toInt() and 0xFF
                                            val b1 = pcm.get().toInt() and 0xFF
                                            val b2 = pcm.get().toInt()
                                            ((b2 shl 16) or (b1 shl 8) or b0).toDouble() / 8388608.0
                                        }
                                        4 -> pcm.getInt().toDouble() / 2147483648.0
                                        else -> pcm.getShort().toDouble() / 32768.0
                                    }
                                    sample = (sample + right) * 0.5
                                    for (c in 2 until channels) {
                                        for (b in 0 until bytesPerSample) pcm.get()
                                    }
                                }
                                rawSamples[writePos] = sample.coerceIn(-1.0, 1.0)
                                writePos = (writePos + 1) and 1023
                            }
                        }
                    }
                }
            }
        } catch (_: Throwable) {
            return
        }

        // 비동기 백그라운드 스레드에서 Goertzel 주파수 분석 실행 (오디오 재생 스레드 무부하)
        if (isAnalyzing.compareAndSet(false, true)) {
            try {
                executor.execute {
                    try {
                        val snapshot = DoubleArray(1024)
                        var readIdx: Int
                        synchronized(bufferLock) {
                            readIdx = writePos
                            for (i in 0 until 1024) {
                                snapshot[i] = rawSamples[(readIdx + i) and 1023] * window[i]
                            }
                        }
                        val coeffs = coefficients
                        val smooth = smoothedBands
                        val newBands = IntArray(64) { band ->
                            var previous = 0.0
                            var beforePrevious = 0.0
                            val coefficient = coeffs[band]
                            for (value in snapshot) {
                                val next = value + coefficient * previous - beforePrevious
                                beforePrevious = previous
                                previous = next
                            }
                            val power = max(0.0, previous * previous + beforePrevious * beforePrevious - coefficient * previous * beforePrevious)
                            val amplitude = sqrt(power) / 256.0
                            val tiltDb = (band / 63.0) * 18.0
                            val db = 20 * log10(max(amplitude, 1e-6)) + tiltDb
                            val targetVal = ((db + 76) / 76.0 * 255.0).toInt().coerceIn(0, 255)
                            val prevVal = smooth[band]
                            val finalVal = if (targetVal > prevVal) {
                                (prevVal * 0.35 + targetVal * 0.65).toInt()
                            } else {
                                (prevVal * 0.75 + targetVal * 0.25).toInt()
                            }
                            smooth[band] = finalVal
                            finalVal
                        }
                        SpectrumStore.bands = newBands
                    } catch (_: Throwable) {
                        // 분석 예외 발생 시 무시
                    } finally {
                        isAnalyzing.set(false)
                    }
                }
            } catch (_: Throwable) {
                isAnalyzing.set(false)
            }
        }
    }

    fun release() {
        try {
            executor.shutdownNow()
        } catch (_: Throwable) {}
    }
}

@UnstableApi
object SpectrumAudioProcessorFactory {
    fun create(sink: SpectrumBufferSink = SpectrumBufferSink()): TeeAudioProcessor =
        TeeAudioProcessor(sink)
}
