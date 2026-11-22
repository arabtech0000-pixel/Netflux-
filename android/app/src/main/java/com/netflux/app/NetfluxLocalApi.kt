package com.netflux.app

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.WebResourceResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.FilterInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class BridgeApiResponse(
    val status: Int,
    val body: String
)

private class DisconnectOnCloseInputStream(
    wrapped: InputStream,
    private val connection: HttpURLConnection
) : FilterInputStream(wrapped) {
    override fun close() {
        try {
            super.close()
        } finally {
            runCatching { connection.disconnect() }
        }
    }
}

class NetfluxLocalApi(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "netflux_local_api"
        private const val KEY_CATALOG_CACHE = "catalog_json_v1"
        private const val KEY_CATALOG_TS = "catalog_ts_v1"
        private const val KEY_USERS_PREFS = "users_flags_v1"
        private const val KEY_SITE_CONFIG = "site_config_v1"

        private const val ADMIN_EMAIL = "ashirafashes04@gmail.com"
        private const val ADMIN_PASSWORD = "popular-24"
        private const val WHATSAPP_GROUP_URL =
            "https://chat.whatsapp.com/EfjzgGyIIBJ1i017P0VlAB?s=cl&p=a&iam=2"
        private const val RTDB_USERS_URL =
            "https://munomoviess-default-rtdb.firebaseio.com/users.json"

        private val MUNO_BASES = listOf(
            "https://freewatchug.online/api/v1",
            "https://mumowatch.ai.studio/api/v1"
        )

        private val MUNO_HTTPS_HOSTS = listOf("b-cdn.net", "r2.dev", "pearlpix", "munotech", "munotek")
        private val CATALOG_TTL_MS = 15L * 60L * 1000L

        private val GENRE_DEFS = listOf(
            "action" to "Action",
            "sports" to "Sports",
            "comedy" to "Comedy",
            "drama" to "Drama",
            "horror" to "Horror",
            "sci-fi" to "Sci-Fi",
            "romance" to "Romance",
            "thriller" to "Thriller",
            "documentary" to "Documentary"
        )

        private const val CHROME_UA =
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val pool = Executors.newFixedThreadPool(8)
    private val catalogLock = Any()

    @Volatile
    private var cachedCatalogObj: JSONObject? = null

    @Volatile
    private var cachedCatalogAt: Long = 0L

    private val itemById = ConcurrentHashMap<String, JSONObject>()
    private val vjVariantsByCanonical = ConcurrentHashMap<String, MutableList<JSONObject>>()
    private val userDirectory = ConcurrentHashMap<String, JSONObject>()

    private val adminSecretKey: ByteArray by lazy {
        MessageDigest.getInstance("SHA-256")
            .digest("netflux-admin:$ADMIN_EMAIL:$ADMIN_PASSWORD".toByteArray(Charsets.UTF_8))
    }

    init {
        restoreUserFlagsFromPrefs()
    }

    fun handleGetOrHeadIntercept(
        uri: Uri,
        method: String,
        requestHeaders: Map<String, String>
    ): WebResourceResponse {
        val path = uri.path ?: "/"
        return try {
            when {
                path == "/api/stream" -> handleStreamProxy(uri, method, requestHeaders)
                path == "/api/tmdb/health" -> jsonResponse(
                    200,
                    JSONObject()
                        .put("ok", true)
                        .put("configured", true)
                        .put("munoSource", MUNO_BASES.first())
                )
                path == "/api/tmdb/catalog" -> jsonResponse(200, getOrBuildCatalog())
                path == "/api/tmdb/trending" -> {
                    val type = uri.getQueryParameter("type") ?: "all"
                    val cat = getOrBuildCatalog()
                    val sections = cat.optJSONObject("sections") ?: JSONObject()
                    val results = when (type) {
                        "movie" -> sections.optJSONArray("movies") ?: JSONArray()
                        "tv", "series" -> sections.optJSONArray("tvShows") ?: JSONArray()
                        else -> sections.optJSONArray("trending") ?: JSONArray()
                    }
                    jsonResponse(200, JSONObject().put("results", results))
                }
                path == "/api/tmdb/search" -> {
                    val q = (uri.getQueryParameter("q") ?: "").trim()
                    val type = uri.getQueryParameter("type") ?: "all"
                    jsonResponse(200, searchCatalogAndLive(q, type))
                }
                path == "/api/tmdb/details" -> jsonResponse(200, buildDetailsResponse(uri))
                path == "/api/tmdb/season" -> jsonResponse(200, buildSeasonResponse(uri))
                path == "/api/public/config" -> jsonResponse(
                    200,
                    JSONObject().put("config", getSiteConfig())
                )
                path == "/api/notifications" -> {
                    val cat = getOrBuildCatalog()
                    val notifs = cat.optJSONArray("notifications") ?: JSONArray()
                    jsonResponse(200, JSONObject().put("notifications", notifs))
                }
                path == "/api/admin/session" -> {
                    val auth = requestHeaders["Authorization"] ?: requestHeaders["authorization"] ?: ""
                    val token = if (auth.startsWith("Bearer ", true)) auth.substring(7).trim() else ""
                    if (verifyAdminToken(token)) {
                        jsonResponse(
                            200,
                            JSONObject().put("ok", true).put("admin", true).put("email", ADMIN_EMAIL)
                        )
                    } else {
                        jsonResponse(401, JSONObject().put("error", "Admin verification required."))
                    }
                }
                else -> jsonResponse(404, JSONObject().put("error", "API endpoint not found"))
            }
        } catch (e: Exception) {
            jsonResponse(
                502,
                JSONObject().put("error", e.message ?: "Request failed")
            )
        }
    }

    fun handleBridgeRequest(
        pathAndQuery: String,
        method: String,
        headersJson: String,
        body: String
    ): BridgeApiResponse {
        return try {
            val fullUri = Uri.parse("https://localhost$pathAndQuery")
            val path = fullUri.path ?: "/"
            val headersMap = mutableMapOf<String, String>()
            runCatching {
                val hObj = JSONObject(if (headersJson.isBlank()) "{}" else headersJson)
                val keys = hObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    headersMap[k] = hObj.optString(k, "")
                }
            }

            val reqBody = runCatching {
                if (body.isBlank()) JSONObject() else JSONObject(body)
            }.getOrDefault(JSONObject())

            val authHeader = headersMap.entries.firstOrNull {
                it.key.equals("authorization", ignoreCase = true)
            }?.value ?: ""
            val bearerToken =
                if (authHeader.startsWith("Bearer ", ignoreCase = true)) authHeader.substring(7).trim() else ""

            when {
                path == "/api/users/sync" && method.equals("POST", true) -> {
                    val idToken = reqBody.optString("idToken", "")
                    val claims = decodeJwtPayload(idToken)
                    val uid = claims?.optString("sub", "")?.trim().orEmpty()
                    val email = claims?.optString("email", "")?.trim()?.lowercase(Locale.US)
                    val displayName = claims?.optString("name", "")?.trim()
                    if (uid.isEmpty()) {
                        return BridgeApiResponse(
                            401,
                            JSONObject().put("ok", false).put("error", "Valid Firebase session required.").toString()
                        )
                    }
                    recordRegisteredUser(uid, if (email.isNullOrBlank()) null else email, displayName)
                    syncRtdbUsersDirectory(false)
                    val key = if (!email.isNullOrBlank()) "email:$email" else "uid:$uid"
                    val matched = userDirectory[key] ?: userDirectory.values.firstOrNull {
                        it.optString("uid") == uid || (!email.isNullOrBlank() && it.optString("email") == email)
                    }
                    val stats = computeUserStats()
                    BridgeApiResponse(
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("totalUsers", stats.optInt("totalUsers", 0))
                            .put("activeUsersNow", stats.optInt("activeUsersNow", 0))
                            .put("isPremium", matched?.optBoolean("isPremium", false) ?: false)
                            .put("isBlocked", matched?.optBoolean("isBlocked", false) ?: false)
                            .toString()
                    )
                }
                path == "/api/admin/verify" && method.equals("POST", true) -> {
                    val email = reqBody.optString("email", "").trim().lowercase(Locale.US)
                    val password = reqBody.optString("password", "")
                    if (email != ADMIN_EMAIL || password != ADMIN_PASSWORD) {
                        return BridgeApiResponse(
                            401,
                            JSONObject()
                                .put("ok", false)
                                .put("admin", false)
                                .put("error", "Incorrect admin email or password. Admin access denied.")
                                .toString()
                        )
                    }
                    recordRegisteredUser("admin:$ADMIN_EMAIL", ADMIN_EMAIL, "Ashraf (Admin)")
                    val token = createAdminToken(ADMIN_EMAIL)
                    BridgeApiResponse(
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("admin", true)
                            .put("email", ADMIN_EMAIL)
                            .put("token", token)
                            .toString()
                    )
                }
                path == "/api/admin/firebase-session" && method.equals("POST", true) -> {
                    val idToken = reqBody.optString("idToken", "")
                    val claims = decodeJwtPayload(idToken)
                    val uid = claims?.optString("sub", "")?.trim().orEmpty()
                    val email = claims?.optString("email", "")?.trim()?.lowercase(Locale.US).orEmpty()
                    val emailVerified = claims?.optBoolean("email_verified", false) == true
                    if (uid.isEmpty() || email != ADMIN_EMAIL || !emailVerified) {
                        return BridgeApiResponse(
                            401,
                            JSONObject()
                                .put("ok", false)
                                .put("admin", false)
                                .put("error", "Verified admin Google/Firebase session required.")
                                .toString()
                        )
                    }
                    recordRegisteredUser(uid, ADMIN_EMAIL, "Ashraf (Admin)")
                    val token = createAdminToken(ADMIN_EMAIL)
                    BridgeApiResponse(
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("admin", true)
                            .put("email", ADMIN_EMAIL)
                            .put("token", token)
                            .toString()
                    )
                }
                path == "/api/admin/session" -> {
                    if (!verifyAdminToken(bearerToken)) {
                        return BridgeApiResponse(401, JSONObject().put("error", "Admin verification required.").toString())
                    }
                    BridgeApiResponse(
                        200,
                        JSONObject().put("ok", true).put("admin", true).put("email", ADMIN_EMAIL).toString()
                    )
                }
                path == "/api/admin/overview" -> {
                    if (!verifyAdminToken(bearerToken)) {
                        return BridgeApiResponse(401, JSONObject().put("error", "Admin verification required.").toString())
                    }
                    syncRtdbUsersDirectory(true)
                    val catalog = getOrBuildCatalog()
                    val allItems = catalog.optJSONArray("all") ?: JSONArray()
                    var moviesCount = 0
                    var seriesCount = 0
                    val vjSet = HashSet<String>()
                    for (i in 0 until allItems.length()) {
                        val item = allItems.optJSONObject(i) ?: continue
                        if (item.optString("type") == "series") seriesCount++ else moviesCount++
                        vjSet.add(normalizeVjName(item.optString("vjName")))
                    }
                    val stats = computeUserStats()
                    val cutoffNow = System.currentTimeMillis() - 15L * 60L * 1000L
                    val usersList = userDirectory.values
                        .filter { u ->
                            val em = u.optString("email", "")
                            em.contains("@") && !isSyntheticTestUser(u.optString("key"), em)
                        }
                        .map { u ->
                            val isBlocked = u.optBoolean("isBlocked", false)
                            val lastSeenAt = u.optLong("lastSeenAt", 0L)
                            JSONObject()
                                .put("key", u.optString("key"))
                                .put("email", u.optString("email"))
                                .put("isPremium", u.optBoolean("isPremium", false))
                                .put("isBlocked", isBlocked)
                                .put("activeNow", !isBlocked && lastSeenAt >= cutoffNow)
                                .put("lastSeenAt", lastSeenAt)
                        }
                        .sortedWith(
                            compareByDescending<JSONObject> { it.optBoolean("activeNow", false) }
                                .thenByDescending { it.optLong("lastSeenAt", 0L) }
                        )
                    val usersArray = JSONArray()
                    usersList.forEach { usersArray.put(it) }

                    stats.put("moviesCount", moviesCount)
                    stats.put("seriesCount", seriesCount)
                    stats.put("totalVods", allItems.length())
                    stats.put("uniqueVjsCount", vjSet.size)

                    val payload = JSONObject()
                        .put("adminEmail", ADMIN_EMAIL)
                        .put("stats", stats)
                        .put("subscriptionSummary", buildSubscriptionSummary())
                        .put("users", usersArray)
                    BridgeApiResponse(200, payload.toString())
                }
                path == "/api/admin/users/premium" && method.equals("POST", true) -> {
                    if (!verifyAdminToken(bearerToken)) {
                        return BridgeApiResponse(401, JSONObject().put("error", "Admin session expired.").toString())
                    }
                    val targetKey = reqBody.optString("key", "").trim()
                    val isPremium = reqBody.optBoolean("isPremium", false)
                    val existing = userDirectory[targetKey]
                        ?: return BridgeApiResponse(404, JSONObject().put("error", "User account not found.").toString())
                    existing.put("isPremium", isPremium)
                    if (isPremium) existing.put("premiumActivatedAt", System.currentTimeMillis())
                    saveUserFlagsToPrefs()
                    BridgeApiResponse(
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("user", existing)
                            .put("stats", computeUserStats())
                            .put("subscriptionSummary", buildSubscriptionSummary())
                            .toString()
                    )
                }
                path == "/api/admin/users/block" && method.equals("POST", true) -> {
                    if (!verifyAdminToken(bearerToken)) {
                        return BridgeApiResponse(401, JSONObject().put("error", "Admin session expired.").toString())
                    }
                    val targetKey = reqBody.optString("key", "").trim()
                    val isBlocked = reqBody.optBoolean("isBlocked", false)
                    val existing = userDirectory[targetKey]
                        ?: return BridgeApiResponse(404, JSONObject().put("error", "User account not found.").toString())
                    if (existing.optString("email").equals(ADMIN_EMAIL, ignoreCase = true)) {
                        return BridgeApiResponse(
                            400,
                            JSONObject().put("error", "Cannot disable the administrator account.").toString()
                        )
                    }
                    existing.put("isBlocked", isBlocked)
                    if (isBlocked) existing.put("blockedAt", System.currentTimeMillis())
                    saveUserFlagsToPrefs()
                    BridgeApiResponse(
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("user", existing)
                            .put("stats", computeUserStats())
                            .toString()
                    )
                }
                path == "/api/admin/config" && method.equals("POST", true) -> {
                    if (!verifyAdminToken(bearerToken)) {
                        return BridgeApiResponse(401, JSONObject().put("error", "Admin session expired.").toString())
                    }
                    val current = getSiteConfig()
                    val updated = JSONObject()
                        .put(
                            "disclaimerEnabled",
                            if (reqBody.has("disclaimerEnabled")) reqBody.optBoolean("disclaimerEnabled")
                            else current.optBoolean("disclaimerEnabled", true)
                        )
                        .put(
                            "disclaimerTitle",
                            reqBody.optString("disclaimerTitle", current.optString("disclaimerTitle"))
                                .ifBlank { current.optString("disclaimerTitle") }
                        )
                        .put(
                            "disclaimerMessage",
                            reqBody.optString("disclaimerMessage", current.optString("disclaimerMessage"))
                                .ifBlank { current.optString("disclaimerMessage") }
                        )
                        .put(
                            "whatsappButtonLabel",
                            reqBody.optString("whatsappButtonLabel", current.optString("whatsappButtonLabel"))
                                .ifBlank { current.optString("whatsappButtonLabel") }
                        )
                        .put(
                            "whatsappGroupUrl",
                            reqBody.optString("whatsappGroupUrl", current.optString("whatsappGroupUrl"))
                                .ifBlank { WHATSAPP_GROUP_URL }
                        )
                        .put(
                            "whatsappPrefillMessage",
                            reqBody.optString("whatsappPrefillMessage", current.optString("whatsappPrefillMessage"))
                                .ifBlank { current.optString("whatsappPrefillMessage") }
                        )
                        .put(
                            "siteAnnouncement",
                            if (reqBody.has("siteAnnouncement")) reqBody.optString("siteAnnouncement", "")
                            else current.optString("siteAnnouncement", "")
                        )
                        .put(
                            "pinnedFeaturedMovieId",
                            if (reqBody.has("pinnedFeaturedMovieId")) reqBody.optString("pinnedFeaturedMovieId", "")
                            else current.optString("pinnedFeaturedMovieId", "")
                        )
                        .put("updatedAt", System.currentTimeMillis())
                    prefs.edit().putString(KEY_SITE_CONFIG, updated.toString()).apply()
                    BridgeApiResponse(200, JSONObject().put("ok", true).put("config", updated).toString())
                }
                else -> BridgeApiResponse(404, JSONObject().put("error", "API endpoint not found").toString())
            }
        } catch (e: Exception) {
            BridgeApiResponse(500, JSONObject().put("error", e.message ?: "Request failed").toString())
        }
    }

    private fun handleStreamProxy(
        uri: Uri,
        method: String,
        requestHeaders: Map<String, String>
    ): WebResourceResponse {
        val rawUrl = uri.getQueryParameter("url") ?: ""
        val cleanUrl = sanitizeStreamUrl(rawUrl)
            ?: return jsonResponse(400, JSONObject().put("error", "Invalid stream URL"))

        val parsed = runCatching { URL(cleanUrl) }.getOrNull()
            ?: return jsonResponse(400, JSONObject().put("error", "Invalid URL"))
        if (parsed.protocol != "https" && parsed.protocol != "http") {
            return jsonResponse(400, JSONObject().put("error", "Unsupported protocol"))
        }

        val isHead = method.equals("HEAD", ignoreCase = true)
        val incomingRange = requestHeaders.entries
            .firstOrNull { it.key.equals("range", ignoreCase = true) }
            ?.value

        val outgoingHeaders = mutableMapOf(
            "User-Agent" to CHROME_UA,
            "Accept" to "*/*"
        )
        if (!isHead && !incomingRange.isNullOrBlank()) {
            outgoingHeaders["Range"] = incomingRange
        } else if (!isHead) {
            outgoingHeaders["Range"] = "bytes=0-"
        }

        val conn = openConnectionFollowingRedirects(
            urlString = cleanUrl,
            method = if (isHead) "HEAD" else "GET",
            headers = outgoingHeaders,
            connectTimeoutMs = 12000,
            readTimeoutMs = 25000
        )

        val code = conn.responseCode
        if (code !in 200..299 && code != 206) {
            val errMsg = conn.responseMessage ?: "Error"
            conn.disconnect()
            return WebResourceResponse(
                "application/json",
                "utf-8",
                if (code in 100..599) code else 502,
                errMsg.ifBlank { "Upstream Error" },
                mapOf("Access-Control-Allow-Origin" to "*"),
                ByteArrayInputStream("{\"error\":\"Upstream HTTP $code\"}".toByteArray())
            )
        }

        val respHeaders = mutableMapOf<String, String>()
        respHeaders["Access-Control-Allow-Origin"] = "*"
        respHeaders["Access-Control-Expose-Headers"] =
            "Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition"
        respHeaders["Accept-Ranges"] = conn.getHeaderField("Accept-Ranges") ?: "bytes"

        val contentType = conn.contentType?.substringBefore(';')?.trim()?.ifBlank { null } ?: "video/mp4"
        respHeaders["Content-Type"] = contentType
        conn.getHeaderField("Content-Length")?.takeIf { it.isNotBlank() }?.let {
            respHeaders["Content-Length"] = it
        }
        conn.getHeaderField("Content-Range")?.takeIf { it.isNotBlank() }?.let {
            respHeaders["Content-Range"] = it
        }

        if (isHead) {
            conn.disconnect()
            return WebResourceResponse(
                contentType,
                null,
                code,
                if (code == 206) "Partial Content" else "OK",
                respHeaders,
                ByteArrayInputStream(ByteArray(0))
            )
        }

        val stream = DisconnectOnCloseInputStream(conn.inputStream, conn)
        return WebResourceResponse(
            contentType,
            null,
            code,
            if (code == 206) "Partial Content" else "OK",
            respHeaders,
            stream
        )
    }

    private fun getOrBuildCatalog(): JSONObject {
        val now = System.currentTimeMillis()
        cachedCatalogObj?.let { current ->
            if (now - cachedCatalogAt < CATALOG_TTL_MS && (current.optJSONArray("all")?.length() ?: 0) > 0) {
                return current
            }
        }

        synchronized(catalogLock) {
            val recheckNow = System.currentTimeMillis()
            cachedCatalogObj?.let { current ->
                if (recheckNow - cachedCatalogAt < CATALOG_TTL_MS && (current.optJSONArray("all")?.length() ?: 0) > 0) {
                    return current
                }
            }

            // Optional check: if BuildConfig.APP_URL happens to be deployed live, prefer its dual-verified JSON
            tryFetchRemoteCatalog()?.let { remoteCatalog ->
                indexCatalogItems(remoteCatalog)
                cachedCatalogObj = remoteCatalog
                cachedCatalogAt = System.currentTimeMillis()
                persistCatalogSnapshot(remoteCatalog)
                return remoteCatalog
            }

            val built = runCatching { buildLiveMunoCatalog() }.getOrNull()
            if (built != null && (built.optJSONArray("all")?.length() ?: 0) > 0) {
                cachedCatalogObj = built
                cachedCatalogAt = System.currentTimeMillis()
                persistCatalogSnapshot(built)
                return built
            }

            // Offline/transient error fallback from last persisted catalog
            loadPersistedCatalog()?.let { diskCatalog ->
                indexCatalogItems(diskCatalog)
                cachedCatalogObj = diskCatalog
                cachedCatalogAt = System.currentTimeMillis()
                return diskCatalog
            }

            return emptyCatalogObject()
        }
    }

    private fun tryFetchRemoteCatalog(): JSONObject? {
        val base = BuildConfig.APP_URL.trim().trimEnd('/')
        if (!base.startsWith("http")) return null
        return try {
            val conn = openConnectionFollowingRedirects(
                urlString = "$base/api/tmdb/catalog",
                method = "GET",
                headers = mapOf("Accept" to "application/json", "User-Agent" to CHROME_UA),
                connectTimeoutMs = 2200,
                readTimeoutMs = 3500
            )
            try {
                if (conn.responseCode != 200) return null
                val cType = (conn.contentType ?: "").lowercase(Locale.US)
                if (!cType.contains("application/json")) return null
                val text = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                if (!text.trimStart().startsWith("{")) return null
                val parsed = JSONObject(text)
                if ((parsed.optJSONArray("all")?.length() ?: 0) > 0) parsed else null
            } finally {
                conn.disconnect()
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun buildLiveMunoCatalog(): JSONObject {
        val endpoints = listOf(
            "/dashboard",
            "/movies?page=1&limit=100",
            "/movies?page=2&limit=100",
            "/movies?page=3&limit=100",
            "/movies?vj=${URLEncoder.encode("Vj Junior", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Emmy", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Ice P", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Ulio", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Jingo", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Heavy Q", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Tom", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Nelly", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Muba", "UTF-8")}&limit=40",
            "/movies?vj=${URLEncoder.encode("Vj Ivo", "UTF-8")}&limit=40"
        )

        val futures = endpoints.map { ep ->
            pool.submit(Callable { runCatching { munoFetchJson(ep) }.getOrNull() })
        }

        val rawCandidates = mutableListOf<JSONObject>()
        futures.forEachIndexed { index, future ->
            val payload = runCatching { future.get(12, TimeUnit.SECONDS) }.getOrNull() ?: return@forEachIndexed
            if (index == 0) {
                val dash = payload.optJSONObject("data") ?: payload
                dash.optJSONObject("featured")?.let { rawCandidates.add(it) }
                appendJsonArrayObjects(dash.optJSONArray("latest"), rawCandidates)
                appendJsonArrayObjects(dash.optJSONArray("continueWatching"), rawCandidates)
                val cats = dash.optJSONObject("categories")
                if (cats != null) {
                    val catKeys = cats.keys()
                    while (catKeys.hasNext()) {
                        appendJsonArrayObjects(cats.optJSONArray(catKeys.next()), rawCandidates)
                    }
                }
            } else {
                appendJsonArrayObjects(payload.optJSONArray("data"), rawCandidates)
            }
        }

        val mapped = dedupAndMapCandidates(rawCandidates, limit = 220)
        if (mapped.isEmpty()) return emptyCatalogObject()

        itemById.clear()
        vjVariantsByCanonical.clear()
        for (item in mapped) {
            itemById[item.optString("id")] = item
            val canonical = item.optString("canonicalKey")
            val list = vjVariantsByCanonical.getOrPut(canonical) { mutableListOf() }
            val vjLower = item.optString("vjName").lowercase(Locale.US)
            if (list.none { it.optString("vjName").lowercase(Locale.US) == vjLower }) {
                list.add(
                    JSONObject()
                        .put("id", item.optString("id"))
                        .put("vjName", item.optString("vjName"))
                        .put("videoUrl", item.optString("videoUrl"))
                        .put("munoId", item.opt("munoId"))
                        .put("seriesCode", item.opt("seriesCode"))
                )
            }
        }

        for (item in mapped) {
            val canonical = item.optString("canonicalKey")
            val list = vjVariantsByCanonical[canonical] ?: emptyList()
            val vjStreamsArr = JSONArray()
            list.forEach { vjStreamsArr.put(it) }
            item.put("vjStreams", vjStreamsArr)
        }

        val uniqueTitles = uniqueByCanonical(mapped)
        val trendingList = uniqueTitles.take(18).mapIndexed { idx, item ->
            JSONObject(item.toString()).apply {
                put("isTrending", true)
                if (idx < 10) put("top10Rank", idx + 1)
            }
        }
        val top10List = trendingList.take(10)
        val tvShowsList = mapped.filter { it.optString("type") == "series" }
        val moviesList = mapped.filter { it.optString("type") == "movie" }
        val upcomingList = mapped.filter { it.optInt("year", 2024) >= 2025 }.take(24)

        val byGenreObj = JSONObject()
        val genreBannersArr = JSONArray()
        val usedBannerUrls = HashSet<String>()

        for ((genreId, genreName) in GENRE_DEFS) {
            val matched = mapped.filter { item ->
                val genres = item.optJSONArray("genres") ?: JSONArray()
                var hit = false
                for (i in 0 until genres.length()) {
                    if (genres.optString(i).equals(genreName, ignoreCase = true)) {
                        hit = true
                        break
                    }
                }
                hit
            }.toMutableList()

            if (matched.isEmpty() && genreName == "Sports") {
                matched.addAll(
                    mapped.filter { item ->
                        val gStr = item.optJSONArray("genres")?.toString()?.lowercase(Locale.US) ?: ""
                        gStr.contains("action") || gStr.contains("documentary") || gStr.contains("adventure")
                    }.take(10)
                )
            }

            val arr = JSONArray()
            matched.forEach { arr.put(it) }
            byGenreObj.put(genreName, arr)

            if (matched.isNotEmpty()) {
                val chosen = matched.firstOrNull {
                    val b = it.optString("backdropUrl")
                    b.isNotBlank() && !usedBannerUrls.contains(b)
                } ?: matched.firstOrNull { it.optString("backdropUrl").isNotBlank() } ?: mapped.first()
                val img = chosen.optString("backdropUrl", "")
                if (img.isNotBlank()) usedBannerUrls.add(img)
                genreBannersArr.put(
                    JSONObject()
                        .put("id", genreId)
                        .put("name", genreName)
                        .put("image", img)
                )
            }
        }

        val featuredCandidates = uniqueTitles
            .filter { it.optString("backdropUrl").isNotBlank() && it.optString("posterUrl").isNotBlank() }
            .ifEmpty { uniqueTitles }
            .take(5)

        val hero = featuredCandidates.firstOrNull { it.optString("type") == "series" }
            ?: tvShowsList.firstOrNull()
            ?: featuredCandidates.firstOrNull()
        val tvHero = tvShowsList.firstOrNull { it.optString("id") != hero?.optString("id") && it.optString("backdropUrl").isNotBlank() }
            ?: tvShowsList.firstOrNull()
            ?: hero

        val notificationsArr = JSONArray()
        trendingList.take(2).forEachIndexed { idx, m ->
            notificationsArr.put(
                JSONObject()
                    .put("id", "muno-tr-${m.optString("id")}")
                    .put(
                        "title",
                        if (idx == 0) "#1 New & Playable Now"
                        else "Translated by ${m.optString("vjName", "VJ")}"
                    )
                    .put("message", "${m.optString("title")} (${m.optInt("year")})")
                    .put("movieId", m.optString("id"))
                    .put("timeAgo", if (idx == 0) "Just now" else "3h ago")
                    .put("read", false)
                    .put("thumbnailUrl", m.optString("backdropUrl").ifBlank { m.optString("posterUrl") })
                    .put("type", "new-arrival")
            )
        }
        upcomingList.take(2).forEachIndexed { idx, m ->
            notificationsArr.put(
                JSONObject()
                    .put("id", "muno-up-${m.optString("id")}")
                    .put("title", "Latest Release")
                    .put("message", "${m.optString("title")} (${m.optString("vjName", "Luganda Dubbed")}) is ready to stream.")
                    .put("movieId", m.optString("id"))
                    .put("timeAgo", "${idx + 1}d ago")
                    .put("read", idx > 0)
                    .put("thumbnailUrl", m.optString("backdropUrl").ifBlank { m.optString("posterUrl") })
                    .put("type", "coming-soon")
            )
        }

        val featuredArr = JSONArray().apply { featuredCandidates.forEach { put(it) } }
        val allArr = JSONArray().apply { mapped.forEach { put(it) } }
        val trendingArr = JSONArray().apply { trendingList.forEach { put(it) } }
        val top10Arr = JSONArray().apply { top10List.forEach { put(it) } }
        val tvArr = JSONArray().apply { tvShowsList.forEach { put(it) } }
        val moviesArr = JSONArray().apply { moviesList.forEach { put(it) } }
        val upcomingArr = JSONArray().apply { upcomingList.forEach { put(it) } }

        val sectionsObj = JSONObject()
            .put("trending", trendingArr)
            .put("top10", top10Arr)
            .put("tvShows", tvArr)
            .put("movies", moviesArr)
            .put("upcoming", upcomingArr)
            .put("byGenre", byGenreObj)

        return JSONObject()
            .put("hero", hero ?: JSONObject.NULL)
            .put("tvHero", tvHero ?: JSONObject.NULL)
            .put("featuredBanners", featuredArr)
            .put("all", allArr)
            .put("sections", sectionsObj)
            .put("genreBanners", genreBannersArr)
            .put("notifications", notificationsArr)
    }

    private fun dedupAndMapCandidates(rawCandidates: List<JSONObject>, limit: Int): List<JSONObject> {
        val mergedByClueVj = LinkedHashMap<String, JSONObject>()
        val seriesCodeToKey = HashMap<String, String>()

        for (raw in rawCandidates) {
            val rawTitle = raw.optString("title", "").trim()
            if (rawTitle.isEmpty()) continue
            val eps = flattenMunoEpisodes(raw)
            val streamUrl = extractPlayableUrl(raw, eps) ?: continue
            val clue = extractTitleClue(rawTitle, raw.optString("vj", ""))
            val cleanKey = clue.cleanTitle.lowercase(Locale.US)
            if (cleanKey.length < 2) continue
            val vjKey = clue.vjName.lowercase(Locale.US)
            val seriesCode = raw.optString("series_code", "").trim()
            val seriesLookup = if (seriesCode.isNotEmpty()) "$seriesCode::$vjKey" else ""

            var mapKey = "$cleanKey::$vjKey"
            if (seriesLookup.isNotEmpty() && seriesCodeToKey.containsKey(seriesLookup)) {
                val mappedKey = seriesCodeToKey[seriesLookup]!!
                val mappedExisting = mergedByClueVj[mappedKey]
                if (mappedExisting != null && isMatchingSeriesTitle(mappedExisting.optString("title"), rawTitle)) {
                    mapKey = mappedKey
                }
            }
            if (seriesLookup.isNotEmpty() && !seriesCodeToKey.containsKey(seriesLookup)) {
                seriesCodeToKey[seriesLookup] = mapKey
            }

            val itemEpList = mergeEpisodeCandidateLists(
                eps,
                listOf(
                    JSONObject()
                        .put("title", rawTitle)
                        .put("streamUrl", streamUrl)
                        .put("playingurl", streamUrl)
                        .put("vj", raw.optString("vj", ""))
                )
            )

            val existing = mergedByClueVj[mapKey]
            if (existing == null) {
                val copy = JSONObject(raw.toString())
                copy.put("_mergedEpisodes", JSONArray(itemEpList))
                mergedByClueVj[mapKey] = copy
            } else {
                val existingEps = mutableListOf<JSONObject>()
                existing.optJSONArray("_mergedEpisodes")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        arr.optJSONObject(i)?.let { existingEps.add(it) }
                    }
                }
                val mergedEps = mergeEpisodeCandidateLists(existingEps, itemEpList)
                val preferNew = itemEpList.size > existingEps.size ||
                    (raw.optString("id").toLongOrNull() ?: 0L) > (existing.optString("id").toLongOrNull() ?: 0L)
                val base = if (preferNew) JSONObject(raw.toString()) else existing
                if (preferNew) {
                    val keys = existing.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        if (!base.has(k) || base.isNull(k)) base.put(k, existing.get(k))
                    }
                }
                if (mergedEps.isNotEmpty()) {
                    val firstUrl = mergedEps[0].optString("streamUrl", streamUrl)
                    base.put("streamUrl", firstUrl)
                    base.put("playingurl", firstUrl)
                }
                base.put("_mergedEpisodes", JSONArray(mergedEps))
                mergedByClueVj[mapKey] = base
            }
        }

        val sorted = mergedByClueVj.values.sortedByDescending {
            it.optString("id").toLongOrNull() ?: 0L
        }.take(limit)

        val out = mutableListOf<JSONObject>()
        sorted.forEachIndexed { idx, raw ->
            mapMunoRawToNetfluxMovie(raw, isTrending = idx < 24)?.let { out.add(it) }
        }
        return out
    }

    private fun mapMunoRawToNetfluxMovie(raw: JSONObject, isTrending: Boolean): JSONObject? {
        val rawTitle = raw.optString("title", "").trim()
        if (rawTitle.isEmpty()) return null
        val clue = extractTitleClue(rawTitle, raw.optString("vj", ""))
        if (clue.cleanTitle.length < 2) return null

        val mergedEpsJson = raw.optJSONArray("_mergedEpisodes")
        val episodeCandidates = mutableListOf<JSONObject>()
        if (mergedEpsJson != null) {
            for (i in 0 until mergedEpsJson.length()) {
                mergedEpsJson.optJSONObject(i)?.let { episodeCandidates.add(it) }
            }
        } else {
            episodeCandidates.addAll(flattenMunoEpisodes(raw))
        }

        val videoUrl = extractPlayableUrl(raw, episodeCandidates) ?: return null
        val isSeries = raw.optBoolean("isTv", false) ||
            raw.optBoolean("is_series", false) ||
            clue.isSeriesHint ||
            episodeCandidates.size > 1
        val mediaType = if (isSeries) "series" else "movie"

        val rawBackdrop = firstNonBlank(
            raw.optString("backdrop_path"),
            raw.optString("backdrop"),
            raw.optString("poster_path"),
            raw.optString("poster"),
            raw.optString("image")
        )
        val rawPoster = firstNonBlank(
            raw.optString("poster_path"),
            raw.optString("poster"),
            raw.optString("image"),
            rawBackdrop
        )
        val backdropUrl = sanitizeImageUrl(rawBackdrop)
        val posterUrl = sanitizeImageUrl(rawPoster).ifBlank { backdropUrl }
        if (backdropUrl.isBlank()) return null

        val seriesCode = raw.optString("series_code", "").trim()
        val munoIdStr = raw.optString("id", seriesCode).trim()
        val titleSlug = clue.cleanTitle.lowercase(Locale.US)
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .ifEmpty { "title" }
        val vjSlug = clue.vjName.lowercase(Locale.US)
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .ifEmpty { "dubbed" }

        val canonicalKey = "muno-$mediaType-$titleSlug"
        val uniqueId = "muno-$mediaType-${munoIdStr.ifEmpty { titleSlug }}-$vjSlug"

        val genreSet = LinkedHashSet<String>()
        raw.optJSONArray("genres")?.let { gArr ->
            for (i in 0 until gArr.length()) {
                val g = gArr.optString(i, "").trim()
                if (g.isNotEmpty() && !g.equals("Luganda Dubbed", true) && !g.equals("Series", true)) {
                    genreSet.add(g)
                }
            }
        }
        val catStr = raw.optString("category", "").trim()
        if (catStr.isNotEmpty() && !catStr.equals("Luganda Dubbed", true) && !catStr.equals("Series", true)) {
            genreSet.add(catStr)
        }
        if (genreSet.isEmpty()) genreSet.add("Action")
        val genresArr = JSONArray()
        genreSet.take(4).forEach { genresArr.put(it) }

        val rating = raw.optDouble("vote_average", 0.0).takeIf { !it.isNaN() && it > 0.0 }
            ?: raw.optString("rating", "").toDoubleOrNull()?.takeIf { it > 0.0 }
            ?: 8.2
        val matchScore = Math.min(99, Math.max(70, Math.round(rating * 10).toInt()))

        val yearStr = raw.optString("year", "")
        val yearMatch = Regex("(19|20)\\d{2}").find(yearStr)
        val year = yearMatch?.value?.toIntOrNull() ?: 2024

        val durationOrSeasons = if (isSeries) {
            if (episodeCandidates.isNotEmpty()) "${episodeCandidates.size} Episodes" else "Series"
        } else {
            firstNonBlank(raw.optString("duration"), raw.optString("runtime")).ifBlank { "1h 45m" }
        }

        val mappedEpisodes = if (isSeries && episodeCandidates.isNotEmpty()) {
            val arr = JSONArray()
            episodeCandidates.forEachIndexed { idx, ep ->
                val epNum = extractEpisodeNumber(ep) ?: (idx + 1)
                val epUrl = sanitizeStreamUrl(firstNonBlank(ep.optString("streamUrl"), ep.optString("playingurl"))) ?: videoUrl
                val epVj = ep.optString("vj", "").trim().takeIf { it.isNotEmpty() }?.let { normalizeVjName(it) } ?: clue.vjName
                arr.put(
                    JSONObject()
                        .put("id", "muno-ep-${seriesCode.ifBlank { munoIdStr.ifBlank { titleSlug } }}-$epNum-$idx")
                        .put("seasonNumber", clue.seasonNumber ?: 1)
                        .put("episodeNumber", epNum)
                        .put("title", ep.optString("title").ifBlank { "Episode $epNum" })
                        .put("duration", "45m")
                        .put("durationSeconds", 45 * 60)
                        .put("synopsis", raw.optString("overview").ifBlank { "Translated by ${clue.vjName}." })
                        .put("thumbnail", posterUrl.ifBlank { backdropUrl })
                        .put("videoUrl", epUrl)
                        .put("vjName", epVj)
                )
            }
            arr
        } else null

        return JSONObject().apply {
            put("id", uniqueId)
            put("canonicalKey", canonicalKey)
            put("title", clue.cleanTitle)
            put("type", mediaType)
            put("year", year)
            put("ageRating", if (isSeries) "16+" else "13+")
            put("quality", "4K Ultra HD")
            put("durationOrSeasons", durationOrSeasons)
            put("genres", genresArr)
            put("synopsis", raw.optString("overview").ifBlank { "${clue.cleanTitle} translated in Luganda by ${clue.vjName}." })
            put("matchScore", matchScore)
            put("posterUrl", posterUrl)
            put("backdropUrl", backdropUrl)
            put("cast", JSONArray())
            put("isOriginal", rating >= 8.1)
            put("isTrending", isTrending)
            put("videoUrl", videoUrl)
            put("vjName", clue.vjName)
            if (munoIdStr.isNotEmpty()) put("munoId", munoIdStr)
            if (seriesCode.isNotEmpty()) put("seriesCode", seriesCode)
            if (mappedEpisodes != null) put("episodes", mappedEpisodes)
        }
    }

    private fun searchCatalogAndLive(query: String, typeParam: String): JSONObject {
        if (query.isBlank()) return JSONObject().put("results", JSONArray())

        val catalog = getOrBuildCatalog()
        val allItems = catalog.optJSONArray("all") ?: JSONArray()
        val lowerQ = query.lowercase(Locale.US)

        val mergedMap = LinkedHashMap<String, JSONObject>()

        for (i in 0 until allItems.length()) {
            val m = allItems.optJSONObject(i) ?: continue
            val titleMatch = m.optString("title", "").lowercase(Locale.US).contains(lowerQ)
            val vjMatch = m.optString("vjName", "").lowercase(Locale.US).contains(lowerQ)
            val genreMatch = m.optJSONArray("genres")?.toString()?.lowercase(Locale.US)?.contains(lowerQ) == true
            if (titleMatch || vjMatch || genreMatch) {
                if (matchesTypeFilter(m, typeParam)) {
                    mergedMap[m.optString("id")] = m
                }
            }
        }

        val vjQuery = if (Regex("^vj[\\s.]", RegexOption.IGNORE_CASE).containsMatchIn(query)) {
            normalizeVjName(query)
        } else {
            "Vj $query"
        }

        val f1 = pool.submit(Callable {
            runCatching { munoFetchJson("/search?q=${URLEncoder.encode(query, "UTF-8")}") }.getOrNull()
        })
        val f2 = pool.submit(Callable {
            runCatching { munoFetchJson("/movies?vj=${URLEncoder.encode(vjQuery, "UTF-8")}&limit=40") }.getOrNull()
        })

        val liveRaw = mutableListOf<JSONObject>()
        runCatching { f1.get(8, TimeUnit.SECONDS) }.getOrNull()?.optJSONArray("data")?.let {
            appendJsonArrayObjects(it, liveRaw)
        }
        runCatching { f2.get(8, TimeUnit.SECONDS) }.getOrNull()?.optJSONArray("data")?.let {
            appendJsonArrayObjects(it, liveRaw)
        }

        for (m in dedupAndMapCandidates(liveRaw, limit = 36)) {
            if (matchesTypeFilter(m, typeParam) && !mergedMap.containsKey(m.optString("id"))) {
                val canonical = m.optString("canonicalKey")
                vjVariantsByCanonical[canonical]?.let { list ->
                    val arr = JSONArray()
                    list.forEach { arr.put(it) }
                    m.put("vjStreams", arr)
                }
                mergedMap[m.optString("id")] = m
            }
        }

        val out = JSONArray()
        mergedMap.values.take(32).forEach { out.put(it) }
        return JSONObject().put("results", out)
    }

    private fun buildDetailsResponse(uri: Uri): JSONObject {
        val requestedId = uri.getQueryParameter("id") ?: ""
        val title = (uri.getQueryParameter("title") ?: "").trim()
        val reqType = if (uri.getQueryParameter("type") in listOf("series", "tv")) "series" else "movie"
        val queryMunoId = uri.getQueryParameter("munoId") ?: ""
        val querySeriesCode = uri.getQueryParameter("seriesCode") ?: ""
        val queryVideoUrl = sanitizeStreamUrl(uri.getQueryParameter("videoUrl"))
        val queryVjName = uri.getQueryParameter("vjName") ?: ""

        val catalog = getOrBuildCatalog()
        val catalogItems = mutableListOf<JSONObject>()
        catalog.optJSONArray("all")?.let { appendJsonArrayObjects(it, catalogItems) }

        val match = (if (requestedId.isNotEmpty()) itemById[requestedId] else null)
            ?: catalogItems.firstOrNull { m ->
                (requestedId.isNotEmpty() && m.optString("id") == requestedId) ||
                    (title.isNotEmpty() && m.optString("title").equals(title, ignoreCase = true))
            }

        val effectiveSeriesCode = querySeriesCode.ifBlank { match?.optString("seriesCode") ?: "" }
        val effectiveMunoId = queryMunoId.ifBlank { match?.optString("munoId") ?: "" }

        var liveEpisodes: List<JSONObject> = emptyList()
        var liveVideoUrl: String? = null
        var liveVjName: String? = null

        if (reqType == "series" && effectiveSeriesCode.isNotEmpty()) {
            val sJson = runCatching {
                munoFetchJson("/series?code=${URLEncoder.encode(effectiveSeriesCode, "UTF-8")}")
            }.getOrNull()
            val payload = sJson?.optJSONObject("data") ?: sJson
            if (payload != null && (title.isEmpty() || isMatchingSeriesTitle(title, payload.optString("title")))) {
                liveEpisodes = flattenMunoEpisodes(payload)
                liveVideoUrl = extractPlayableUrl(payload, liveEpisodes)
                liveVjName = payload.optString("vj", "").takeIf { it.isNotBlank() }?.let { normalizeVjName(it) }
            }
        } else if (effectiveMunoId.isNotEmpty() && (match?.optString("videoUrl").isNullOrBlank())) {
            val mJson = runCatching {
                munoFetchJson("/movie?id=${URLEncoder.encode(effectiveMunoId, "UTF-8")}")
            }.getOrNull()
            val payload = mJson?.optJSONObject("data") ?: mJson
            if (payload != null) {
                liveEpisodes = flattenMunoEpisodes(payload)
                liveVideoUrl = extractPlayableUrl(payload, liveEpisodes)
            }
        }

        val finalObj = if (match != null) JSONObject(match.toString()) else JSONObject().apply {
            put("id", requestedId.ifBlank { "muno-$reqType-${title.lowercase(Locale.US)}" })
            put("title", title.ifBlank { "Featured Title" })
            put("type", reqType)
            put("year", 2024)
            put("ageRating", if (reqType == "series") "16+" else "13+")
            put("quality", "4K Ultra HD")
            put("durationOrSeasons", if (reqType == "series") "Series" else "1h 45m")
            put("genres", JSONArray().put("Action"))
            put("synopsis", "Translated in Luganda and ready to stream.")
            put("matchScore", 86)
            put("posterUrl", "")
            put("backdropUrl", "")
            put("cast", JSONArray())
        }

        val resolvedVideoUrl = queryVideoUrl ?: finalObj.optString("videoUrl").takeIf { it.isNotBlank() } ?: liveVideoUrl
        if (!resolvedVideoUrl.isNullOrBlank()) {
            finalObj.put("videoUrl", resolvedVideoUrl)
        }
        val resolvedVj = queryVjName.takeIf { it.isNotBlank() }?.let { normalizeVjName(it) }
            ?: finalObj.optString("vjName").takeIf { it.isNotBlank() }
            ?: liveVjName
        if (!resolvedVj.isNullOrBlank()) {
            finalObj.put("vjName", resolvedVj)
        }

        if (reqType == "series" && liveEpisodes.isNotEmpty()) {
            val existingEps = finalObj.optJSONArray("episodes")
            if (existingEps == null || liveEpisodes.size > existingEps.length()) {
                val thumb = finalObj.optString("backdropUrl").ifBlank { finalObj.optString("posterUrl") }
                val epArr = JSONArray()
                liveEpisodes.forEachIndexed { idx, ep ->
                    val epNum = extractEpisodeNumber(ep) ?: (idx + 1)
                    epArr.put(
                        JSONObject()
                            .put("id", "muno-ep-${effectiveSeriesCode.ifBlank { effectiveMunoId.ifBlank { "s" } }}-$epNum-$idx")
                            .put("seasonNumber", 1)
                            .put("episodeNumber", epNum)
                            .put("title", ep.optString("title").ifBlank { "Episode $epNum" })
                            .put("duration", "45m")
                            .put("durationSeconds", 45 * 60)
                            .put("synopsis", finalObj.optString("synopsis").ifBlank { "Ready to stream." })
                            .put("thumbnail", thumb)
                            .put("videoUrl", sanitizeStreamUrl(firstNonBlank(ep.optString("streamUrl"), ep.optString("playingurl"))) ?: resolvedVideoUrl)
                            .put("vjName", ep.optString("vj", "").takeIf { it.isNotBlank() }?.let { normalizeVjName(it) } ?: resolvedVj)
                    )
                }
                finalObj.put("episodes", epArr)
            }
        }

        val similarArr = JSONArray()
        val selfId = finalObj.optString("id")
        catalogItems
            .filter { it.optString("id") != selfId && it.optString("videoUrl").isNotBlank() && it.optString("backdropUrl").isNotBlank() }
            .take(9)
            .forEach { similarArr.put(it) }
        finalObj.put("similarMovies", similarArr)

        return JSONObject().put("movie", finalObj)
    }

    private fun buildSeasonResponse(uri: Uri): JSONObject {
        val season = (uri.getQueryParameter("season")?.toIntOrNull() ?: 1).coerceAtLeast(1)
        val fallbackBackdrop = uri.getQueryParameter("backdrop") ?: ""
        val seriesCode = (uri.getQueryParameter("seriesCode") ?: "").trim()
        val tmdbId = uri.getQueryParameter("tmdbId") ?: ""

        if (seriesCode.isEmpty() && tmdbId.isEmpty()) {
            return JSONObject().put("episodes", JSONArray())
        }

        val match = itemById.values.firstOrNull {
            (seriesCode.isNotEmpty() && it.optString("seriesCode") == seriesCode) ||
                (tmdbId.isNotEmpty() && it.optString("tmdbId") == tmdbId)
        }

        val liveEps = if (seriesCode.isNotEmpty()) {
            val sJson = runCatching {
                munoFetchJson("/series?code=${URLEncoder.encode(seriesCode, "UTF-8")}")
            }.getOrNull()
            val payload = sJson?.optJSONObject("data") ?: sJson
            if (payload != null) flattenMunoEpisodes(payload) else emptyList()
        } else emptyList()

        val epArr = JSONArray()
        if (liveEps.isNotEmpty()) {
            liveEps.forEachIndexed { idx, ep ->
                val epNum = extractEpisodeNumber(ep) ?: (idx + 1)
                epArr.put(
                    JSONObject()
                        .put("id", "muno-ep-${seriesCode.ifBlank { tmdbId.ifBlank { "s" } }}-$season-$epNum-$idx")
                        .put("seasonNumber", season)
                        .put("episodeNumber", epNum)
                        .put("title", ep.optString("title").ifBlank { "Episode $epNum" })
                        .put("duration", "45m")
                        .put("durationSeconds", 45 * 60)
                        .put("synopsis", "Ready to stream.")
                        .put("thumbnail", fallbackBackdrop)
                        .put("videoUrl", sanitizeStreamUrl(firstNonBlank(ep.optString("streamUrl"), ep.optString("playingurl"))))
                        .put("vjName", ep.optString("vj", "").takeIf { it.isNotBlank() }?.let { normalizeVjName(it) })
                )
            }
        } else {
            match?.optJSONArray("episodes")?.let { existing ->
                for (i in 0 until existing.length()) {
                    epArr.put(existing.optJSONObject(i))
                }
            }
        }

        return JSONObject().put("episodes", epArr)
    }

    private fun munoFetchJson(endpoint: String): JSONObject {
        var lastError: Exception? = null
        for (base in MUNO_BASES) {
            try {
                val conn = openConnectionFollowingRedirects(
                    urlString = "$base$endpoint",
                    method = "GET",
                    headers = mapOf("Accept" to "application/json", "User-Agent" to CHROME_UA),
                    connectTimeoutMs = 8000,
                    readTimeoutMs = 10000
                )
                try {
                    if (conn.responseCode in 200..299) {
                        val body = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                        return JSONObject(body)
                    } else {
                        lastError = RuntimeException("MunoWatch HTTP ${conn.responseCode} on $endpoint")
                    }
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw (lastError ?: RuntimeException("MunoWatch request failed on $endpoint"))
    }

    private fun openConnectionFollowingRedirects(
        urlString: String,
        method: String,
        headers: Map<String, String>,
        connectTimeoutMs: Int,
        readTimeoutMs: Int
    ): HttpURLConnection {
        var current = urlString
        for (hop in 0 until 6) {
            val conn = (URL(current).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                requestMethod = method
                connectTimeout = connectTimeoutMs
                readTimeout = readTimeoutMs
                for ((k, v) in headers) {
                    setRequestProperty(k, v)
                }
            }
            val code = conn.responseCode
            if (code in listOf(301, 302, 303, 307, 308)) {
                val loc = conn.getHeaderField("Location")
                conn.disconnect()
                if (loc.isNullOrBlank()) throw RuntimeException("Empty redirect location")
                current = URL(URL(current), loc).toString()
                continue
            }
            return conn
        }
        throw RuntimeException("Too many redirects for $urlString")
    }

    private fun syncRtdbUsersDirectory(force: Boolean) {
        try {
            val conn = openConnectionFollowingRedirects(
                urlString = RTDB_USERS_URL,
                method = "GET",
                headers = mapOf("Accept" to "application/json", "User-Agent" to CHROME_UA),
                connectTimeoutMs = if (force) 6000 else 3500,
                readTimeoutMs = if (force) 7000 else 4000
            )
            try {
                if (conn.responseCode != 200) return
                val text = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                if (!text.trimStart().startsWith("{")) return
                val obj = JSONObject(text)
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val nodeKey = keys.next()
                    val nodeVal = obj.optJSONObject(nodeKey) ?: continue
                    val acct = nodeVal.optJSONObject("account")
                    val uid = acct?.optString("uid")?.takeIf { it.isNotBlank() } ?: nodeKey
                    val email = firstNonBlank(
                        acct?.optString("email"),
                        acct?.optString("identifier")
                    ).trim().lowercase(Locale.US).takeIf { it.contains("@") }
                    val displayName = firstNonBlank(acct?.optString("displayName"), acct?.optString("identifier"))
                        .ifBlank { email ?: "Netflux Member" }
                    val createdAt = acct?.optLong("createdAt", 0L)?.takeIf { it > 0 }
                        ?: acct?.optLong("lastLoginAt", 0L)?.takeIf { it > 0 }
                        ?: System.currentTimeMillis()
                    val lastSeenAt = acct?.optLong("lastLoginAt", 0L) ?: 0L
                    if (!isSyntheticTestUser(nodeKey, email) && !isSyntheticTestUser(uid, email)) {
                        mergeUserRecord(
                            key = if (email != null) "email:$email" else "uid:$uid",
                            uid = uid,
                            email = email,
                            displayName = displayName,
                            createdAt = createdAt,
                            lastSeenAt = lastSeenAt
                        )
                    }
                }
            } finally {
                conn.disconnect()
            }
        } catch (_: Exception) {
            // Keep local cached user directory
        }
    }

    private fun recordRegisteredUser(uid: String, email: String?, displayName: String?) {
        val cleanEmail = email?.trim()?.lowercase(Locale.US)?.takeIf { it.contains("@") }
        if (isSyntheticTestUser(uid, cleanEmail)) return
        val key = if (cleanEmail != null) "email:$cleanEmail" else "uid:$uid"
        val now = System.currentTimeMillis()
        mergeUserRecord(
            key = key,
            uid = uid,
            email = cleanEmail,
            displayName = displayName?.ifBlank { cleanEmail ?: "Netflux Member" } ?: "Netflux Member",
            createdAt = now,
            lastSeenAt = now
        )
        saveUserFlagsToPrefs()
    }

    private fun mergeUserRecord(
        key: String,
        uid: String,
        email: String?,
        displayName: String,
        createdAt: Long,
        lastSeenAt: Long
    ) {
        val existing = userDirectory[key]
        if (existing != null) {
            if (uid.isNotBlank()) existing.put("uid", uid)
            if (!email.isNullOrBlank()) existing.put("email", email)
            if (displayName.isNotBlank()) existing.put("displayName", displayName)
            existing.put("lastSeenAt", maxOf(existing.optLong("lastSeenAt", 0L), lastSeenAt))
        } else {
            userDirectory[key] = JSONObject()
                .put("key", key)
                .put("uid", uid)
                .put("email", email ?: JSONObject.NULL)
                .put("displayName", displayName)
                .put("createdAt", createdAt)
                .put("lastSeenAt", lastSeenAt)
                .put("isPremium", false)
                .put("isBlocked", false)
        }
    }

    private fun computeUserStats(): JSONObject {
        val now = System.currentTimeMillis()
        val cutoffToday = now - 24L * 60L * 60L * 1000L
        val cutoffNow = now - 15L * 60L * 1000L
        var total = 0
        var activeNow = 0
        var activeToday = 0
        var premiumCount = 0
        var blockedCount = 0

        for (u in userDirectory.values) {
            val k = u.optString("key")
            val em = u.optString("email", "")
            if (isSyntheticTestUser(k, em)) continue
            total++
            if (u.optBoolean("isBlocked", false)) {
                blockedCount++
            } else {
                if (u.optBoolean("isPremium", false)) premiumCount++
                val seen = u.optLong("lastSeenAt", 0L)
                if (seen >= cutoffToday) activeToday++
                if (seen >= cutoffNow) activeNow++
            }
        }
        return JSONObject()
            .put("totalUsers", total)
            .put("activeUsersNow", activeNow)
            .put("activeUsersToday", activeToday)
            .put("premiumUsersCount", premiumCount)
            .put("blockedUsersCount", blockedCount)
    }

    private fun buildSubscriptionSummary(): JSONObject {
        val activeUsers = userDirectory.values.filter {
            !it.optBoolean("isBlocked", false) && !isSyntheticTestUser(it.optString("key"), it.optString("email"))
        }
        val premiumCount = activeUsers.count { it.optBoolean("isPremium", false) }
        val freeCount = maxOf(0, activeUsers.size - premiumCount)
        val weeklyProfit = premiumCount * 4000
        val projectedMonthly = premiumCount * 8000
        val weights = listOf(0.1, 0.12, 0.14, 0.13, 0.17, 0.19, 0.15)
        val days = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

        val breakdown = JSONArray()
        days.forEachIndexed { i, day ->
            breakdown.put(
                JSONObject()
                    .put("day", day)
                    .put("profitUgx", Math.round(weeklyProfit * weights[i]))
                    .put("subscribers", premiumCount)
            )
        }

        val plans = JSONArray()
            .put(
                JSONObject().put("id", "daily").put("name", "Daily Pass")
                    .put("priceLabel", "1,000 UGX / day").put("amountUgx", 1000)
                    .put("periodLabel", "24 Hours").put("activeCount", 0)
            )
            .put(
                JSONObject().put("id", "weekly").put("name", "Weekly Pass")
                    .put("priceLabel", "4,000 UGX / week").put("amountUgx", 4000)
                    .put("periodLabel", "7 Days").put("activeCount", premiumCount)
            )
            .put(
                JSONObject().put("id", "monthly").put("name", "Monthly VIP")
                    .put("priceLabel", "8,000 UGX / month").put("amountUgx", 8000)
                    .put("periodLabel", "30 Days").put("activeCount", premiumCount)
            )

        return JSONObject()
            .put("paymentsEnabled", false)
            .put("weeklyProfitUgx", weeklyProfit)
            .put("projectedMonthlyUgx", projectedMonthly)
            .put("premiumUsersCount", premiumCount)
            .put("freeUsersCount", freeCount)
            .put("plans", plans)
            .put("weeklyBreakdown", breakdown)
    }

    private fun getSiteConfig(): JSONObject {
        val raw = prefs.getString(KEY_SITE_CONFIG, null)
        if (!raw.isNullOrBlank()) {
            runCatching { return JSONObject(raw) }
        }
        return JSONObject()
            .put("disclaimerEnabled", true)
            .put("disclaimerTitle", "Join Our WhatsApp Group")
            .put(
                "disclaimerMessage",
                "Join our WhatsApp group for instant updates on newly translated Luganda movies, trending series, fresh VJ releases, and direct community support."
            )
            .put("whatsappButtonLabel", "Join our platform")
            .put("whatsappGroupUrl", WHATSAPP_GROUP_URL)
            .put("whatsappPrefillMessage", "Hello Admin, I just joined via the platform WhatsApp link!")
            .put("siteAnnouncement", "")
            .put("pinnedFeaturedMovieId", "")
            .put("updatedAt", System.currentTimeMillis())
    }

    private fun createAdminToken(email: String): String {
        val payload = JSONObject()
            .put("email", email)
            .put("iat", System.currentTimeMillis())
            .put("exp", System.currentTimeMillis() + 365L * 24L * 60L * 60L * 1000L)
            .toString()
        val flags = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        val payloadB64 = Base64.encodeToString(payload.toByteArray(Charsets.UTF_8), flags)
        val mac = Mac.getInstance("HmacSHA256").apply {
            init(SecretKeySpec(adminSecretKey, "HmacSHA256"))
        }
        val sig = Base64.encodeToString(mac.doFinal(payloadB64.toByteArray(Charsets.UTF_8)), flags)
        return "$payloadB64.$sig"
    }

    private fun verifyAdminToken(token: String): Boolean {
        val parts = token.split('.')
        if (parts.size != 2) return false
        val flags = Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        return runCatching {
            val mac = Mac.getInstance("HmacSHA256").apply {
                init(SecretKeySpec(adminSecretKey, "HmacSHA256"))
            }
            val expected = Base64.encodeToString(mac.doFinal(parts[0].toByteArray(Charsets.UTF_8)), flags)
            if (expected != parts[1]) return false
            val payloadBytes = Base64.decode(parts[0], Base64.URL_SAFE)
            val parsed = JSONObject(String(payloadBytes, Charsets.UTF_8))
            parsed.optString("email").equals(ADMIN_EMAIL, ignoreCase = true) &&
                parsed.optLong("exp", 0L) > System.currentTimeMillis()
        }.getOrDefault(false)
    }

    private fun decodeJwtPayload(jwt: String): JSONObject? {
        val parts = jwt.trim().split('.')
        if (parts.size != 3) return null
        return runCatching {
            val bytes = Base64.decode(parts[1], Base64.URL_SAFE)
            JSONObject(String(bytes, Charsets.UTF_8))
        }.getOrNull()
    }

    private fun restoreUserFlagsFromPrefs() {
        val raw = prefs.getString(KEY_USERS_PREFS, null) ?: return
        runCatching {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val key = obj.optString("key")
                if (key.isNotBlank() && !isSyntheticTestUser(key, obj.optString("email"))) {
                    userDirectory[key] = obj
                }
            }
        }
    }

    private fun saveUserFlagsToPrefs() {
        val arr = JSONArray()
        userDirectory.values.forEach { arr.put(it) }
        prefs.edit().putString(KEY_USERS_PREFS, arr.toString()).apply()
    }

    private fun persistCatalogSnapshot(catalog: JSONObject) {
        runCatching {
            prefs.edit()
                .putString(KEY_CATALOG_CACHE, catalog.toString())
                .putLong(KEY_CATALOG_TS, System.currentTimeMillis())
                .apply()
        }
    }

    private fun loadPersistedCatalog(): JSONObject? {
        val raw = prefs.getString(KEY_CATALOG_CACHE, null) ?: return null
        return runCatching { JSONObject(raw) }.getOrNull()
    }

    private fun indexCatalogItems(catalog: JSONObject) {
        val arr = catalog.optJSONArray("all") ?: return
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val id = item.optString("id")
            if (id.isNotBlank()) itemById[id] = item
        }
    }

    private fun flattenMunoEpisodes(raw: JSONObject): List<JSONObject> {
        val out = mutableListOf<JSONObject>()
        fun push(ep: JSONObject) {
            val url = sanitizeStreamUrl(firstNonBlank(ep.optString("streamUrl"), ep.optString("playingurl")))
            if (url != null) {
                val copy = JSONObject()
                copy.put("title", firstNonBlank(ep.optString("title"), ep.optString("name"), raw.optString("title")))
                copy.put("streamUrl", url)
                copy.put("playingurl", url)
                if (ep.has("episodeNumber")) copy.put("episodeNumber", ep.optInt("episodeNumber"))
                val vj = firstNonBlank(ep.optString("vj"), raw.optString("vj"))
                if (vj.isNotBlank()) copy.put("vj", vj)
                out.add(copy)
            }
            val nested = ep.optJSONArray("episodes")
            if (nested != null) {
                for (i in 0 until nested.length()) {
                    nested.optJSONObject(i)?.let { push(it) }
                }
            }
        }
        val rootEps = raw.optJSONArray("episodes") ?: return out
        for (i in 0 until rootEps.length()) {
            rootEps.optJSONObject(i)?.let { push(it) }
        }
        return out
    }

    private fun mergeEpisodeCandidateLists(
        a: List<JSONObject>,
        b: List<JSONObject>
    ): List<JSONObject> {
        val seen = HashSet<String>()
        val merged = mutableListOf<JSONObject>()
        for (ep in a + b) {
            val url = sanitizeStreamUrl(firstNonBlank(ep.optString("streamUrl"), ep.optString("playingurl"))) ?: continue
            val epNum = extractEpisodeNumber(ep)
            val key = "${epNum ?: -1}::$url"
            if (seen.add(key)) {
                val copy = JSONObject(ep.toString())
                if (epNum != null) copy.put("episodeNumber", epNum)
                copy.put("streamUrl", url)
                copy.put("playingurl", url)
                merged.add(copy)
            }
        }
        return merged.sortedBy { it.optInt("episodeNumber", 9999) }
    }

    private fun extractPlayableUrl(raw: JSONObject, eps: List<JSONObject>): String? {
        return sanitizeStreamUrl(firstNonBlank(raw.optString("streamUrl"), raw.optString("playingurl")))
            ?: eps.firstOrNull()?.optString("streamUrl")?.let { sanitizeStreamUrl(it) }
    }

    private fun extractEpisodeNumber(ep: JSONObject): Int? {
        val direct = ep.optInt("episodeNumber", 0).takeIf { it > 0 }
            ?: ep.optInt("episode_number", 0).takeIf { it > 0 }
        if (direct != null) return direct
        val text = "${ep.optString("title")} ${ep.optString("name")} ${ep.optString("streamUrl")}"
        Regex("s\\d{1,2}\\s*e0*(\\d{1,3})\\b", RegexOption.IGNORE_CASE).find(text)?.let {
            return it.groupValues[1].toIntOrNull()
        }
        Regex("\\bep(?:isode)?\\s*[-_:#]?\\s*0*(\\d{1,3})\\b", RegexOption.IGNORE_CASE).find(text)?.let {
            return it.groupValues[1].toIntOrNull()
        }
        Regex("\\bpart\\s*0*(\\d{1,3})\\b", RegexOption.IGNORE_CASE).find(text)?.let {
            return it.groupValues[1].toIntOrNull()
        }
        val title = firstNonBlank(ep.optString("title"), ep.optString("name")).trim()
        Regex("\\b0*(\\d{1,3})$").find(title)?.let {
            return it.groupValues[1].toIntOrNull()
        }
        return null
    }

    private data class TitleClue(
        val cleanTitle: String,
        val vjName: String,
        val isSeriesHint: Boolean,
        val seasonNumber: Int?
    )

    private fun extractTitleClue(rawTitle: String, explicitVj: String?): TitleClue {
        var working = rawTitle.trim()
        var extractedVj = ""
        val vjMatch = Regex("\\b(VJ\\s+[A-Za-z0-9\\-]+|VJ\\.[A-Za-z0-9\\-]+)\\b", RegexOption.IGNORE_CASE).find(working)
        if (vjMatch != null) {
            extractedVj = vjMatch.value
            working = working.replace(vjMatch.value, " ")
        }
        var seasonNum: Int? = null
        var isSeries = false
        Regex("\\b(?:season|s)\\s*0*(\\d{1,2})\\b", RegexOption.IGNORE_CASE).find(working)?.let {
            seasonNum = it.groupValues[1].toIntOrNull()
            isSeries = true
        }
        if (Regex("\\b(?:ep(?:isode)?\\s*\\d+|s\\d{1,2}e\\d{1,2})\\b", RegexOption.IGNORE_CASE).containsMatchIn(working)) {
            isSeries = true
        }
        working = working
            .replace(Regex("\\(\\s*(?:19|20)\\d{2}\\s*\\)"), " ")
            .replace(Regex("\\[\\s*(?:19|20)\\d{2}\\s*\\]"), " ")
            .replace(Regex("\\b(?:season|s)\\s*\\d{1,2}(?:\\s*e\\d{1,2})?\\b", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("\\bep(?:isode)?\\s*\\d+\\b", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("\\bpart\\s*\\d+\\b", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("\\bluganda\\s*(?:dubbed|translated)?\\b", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("[:\\-–|]+$"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        val vjSource = if (!explicitVj.isNullOrBlank()) explicitVj else extractedVj
        return TitleClue(
            cleanTitle = working.ifEmpty { rawTitle.trim() },
            vjName = normalizeVjName(vjSource),
            isSeriesHint = isSeries,
            seasonNumber = seasonNum
        )
    }

    private fun normalizeVjName(rawVj: String?): String {
        if (rawVj.isNullOrBlank()) return "Luganda Dubbed"
        val cleaned = rawVj.replace('.', ' ').replace(Regex("\\s+"), " ").trim()
        if (cleaned.isEmpty() || cleaned.equals("Luganda Dubbed", true)) return "Luganda Dubbed"
        return cleaned.split(' ').joinToString(" ") { part ->
            when {
                part.equals("vj", true) -> "VJ"
                part.isNotEmpty() && part[0].isLetter() ->
                    part[0].uppercaseChar() + part.substring(1).lowercase(Locale.US)
                else -> part
            }
        }
    }

    private fun uniqueByCanonical(items: List<JSONObject>): List<JSONObject> {
        val seen = HashSet<String>()
        val out = mutableListOf<JSONObject>()
        for (m in items) {
            val k = m.optString("canonicalKey").ifBlank { m.optString("title").lowercase(Locale.US) }
            if (seen.add(k)) out.add(m)
        }
        return out
    }

    private fun isMatchingSeriesTitle(expected: String?, candidate: String?): Boolean {
        if (expected.isNullOrBlank() || candidate.isNullOrBlank()) return true
        val cleanExp = extractTitleClue(expected, null).cleanTitle.lowercase(Locale.US)
            .replace(Regex("^(the|a|an)\\s+"), "").replace(Regex("[^a-z0-9\\s]"), " ").trim()
        val cleanCand = extractTitleClue(candidate, null).cleanTitle.lowercase(Locale.US)
            .replace(Regex("^(the|a|an)\\s+"), "").replace(Regex("[^a-z0-9\\s]"), " ").trim()
        if (cleanExp == cleanCand || cleanExp.contains(cleanCand) || cleanCand.contains(cleanExp)) return true
        val expWords = cleanExp.split(Regex("\\s+")).filter { it.length > 2 }
        val candWords = cleanCand.split(Regex("\\s+")).filter { it.length > 2 }
        if (expWords.isEmpty() || candWords.isEmpty()) return true
        return expWords.any { it in candWords }
    }

    private fun matchesTypeFilter(item: JSONObject, typeParam: String): Boolean {
        return when (typeParam) {
            "movie" -> item.optString("type") == "movie"
            "series", "tv" -> item.optString("type") == "series"
            else -> true
        }
    }

    private fun isSyntheticTestUser(keyOrUid: String?, email: String?): Boolean {
        val k = (keyOrUid ?: "").trim().lowercase(Locale.US)
        val e = (email ?: "").trim().lowercase(Locale.US)
        if (k in setOf("browser_check_example_test", "player_check_example_com", "admin_ashiraf")) return true
        if (e.endsWith("@example.com") || e.endsWith("@example.test")) return true
        return Regex("^member_\\d{10,}@gmail\\.com$").matches(e)
    }

    fun sanitizeStreamUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        val trimmed = rawUrl.trim()
        if (!trimmed.startsWith("http://", true) && !trimmed.startsWith("https://", true)) return null
        if (Regex("\\.\\.(mp4|m3u8|mkv|webm)(\\?|$)", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)) return null
        var normalized = trimmed
        if (normalized.startsWith("http://", true)) {
            val lower = normalized.lowercase(Locale.US)
            if (MUNO_HTTPS_HOSTS.any { lower.contains(it) }) {
                normalized = "https://" + normalized.substring(7)
            }
        }
        return normalized.replace(" ", "%20")
    }

    private fun sanitizeImageUrl(rawUrl: String?): String {
        if (rawUrl.isNullOrBlank()) return ""
        val trimmed = rawUrl.trim()
        if (!trimmed.startsWith("http://", true) && !trimmed.startsWith("https://", true)) return ""
        var normalized = trimmed
        if (normalized.startsWith("http://", true)) {
            val lower = normalized.lowercase(Locale.US)
            if (MUNO_HTTPS_HOSTS.any { lower.contains(it) }) {
                normalized = "https://" + normalized.substring(7)
            }
        }
        return normalized.replace(" ", "%20")
    }

    private fun appendJsonArrayObjects(arr: JSONArray?, dest: MutableList<JSONObject>) {
        if (arr == null) return
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { dest.add(it) }
        }
    }

    private fun firstNonBlank(vararg values: String?): String {
        for (v in values) {
            if (!v.isNullOrBlank() && v != "null") return v.trim()
        }
        return ""
    }

    private fun emptyCatalogObject(): JSONObject {
        val sections = JSONObject()
            .put("trending", JSONArray())
            .put("top10", JSONArray())
            .put("tvShows", JSONArray())
            .put("movies", JSONArray())
            .put("upcoming", JSONArray())
            .put("byGenre", JSONObject())
        return JSONObject()
            .put("hero", JSONObject.NULL)
            .put("tvHero", JSONObject.NULL)
            .put("featuredBanners", JSONArray())
            .put("all", JSONArray())
            .put("sections", sections)
            .put("genreBanners", JSONArray())
            .put("notifications", JSONArray())
    }

    private fun jsonResponse(statusCode: Int, json: JSONObject): WebResourceResponse {
        val bytes = json.toString().toByteArray(Charsets.UTF_8)
        val reason = when (statusCode) {
            200 -> "OK"
            400 -> "Bad Request"
            401 -> "Unauthorized"
            404 -> "Not Found"
            else -> "Error"
        }
        return WebResourceResponse(
            "application/json",
            "utf-8",
            statusCode,
            reason,
            mapOf(
                "Cache-Control" to "no-store",
                "Access-Control-Allow-Origin" to "*"
            ),
            ByteArrayInputStream(bytes)
        )
    }

    fun shutdown() {
        pool.shutdownNow()
    }
}
