package com.family.refillr

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform