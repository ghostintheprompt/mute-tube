/*
    YARA Rules: Browser Extension Malicious Behavior Detection
    Author: Mute Tube Security Research
    Reference: https://github.com/ghostintheprompt/mute-tube

    These rules detect patterns present in malicious browser extensions.
    They were written to identify the specific attack techniques demonstrated
    in the /research directory — and to prove that mute-tube's source does
    not match them.

    Usage:
        yara -r extension.yar /path/to/extension/src/
*/

rule Extension_Exfil_Via_Fetch {
    meta:
        description = "Detects extension background scripts making outbound fetch calls to non-localhost URLs"
        severity = "HIGH"
        mitre = "T1041 - Exfiltration Over C2 Channel"
    strings:
        $fetch_call   = /fetch\s*\(\s*['"`]https?:\/\// nocase
        $xhr_open     = /\.open\s*\(\s*['"`](GET|POST)['"`]\s*,\s*['"`]https?:\/\// nocase
        $send_beacon  = /navigator\.sendBeacon\s*\(/ nocase
    condition:
        any of them
}

rule Extension_Input_Capture {
    meta:
        description = "Detects extension content scripts reading password or credential field values"
        severity = "CRITICAL"
        mitre = "T1056.004 - Input Capture: Credential API Hooking"
    strings:
        $pw_selector  = /querySelector[All]?\s*\([^)]*type\s*=\s*['"]password['"]/ nocase
        $pw_value     = /\.value/ nocase
        $keydown      = "addEventListener('keydown'" nocase
        $keypress     = "addEventListener('keypress'" nocase
        $input_event  = "addEventListener('input'" nocase
    condition:
        $pw_selector and $pw_value and (any of ($key*, $input_event))
}

rule Extension_Cookie_Theft {
    meta:
        description = "Detects extension attempting to access document.cookie or chrome.cookies API"
        severity = "CRITICAL"
        mitre = "T1539 - Steal Web Session Cookie"
    strings:
        $doc_cookie   = "document.cookie" nocase
        $chrome_cookie = "chrome.cookies.getAll" nocase
        $local_storage = "localStorage.getItem" nocase
    condition:
        any of them
}

rule Extension_Manifest_Permission_Overreach {
    meta:
        description = "Detects manifest.json requesting high-risk permission combinations"
        severity = "HIGH"
        mitre = "T1176 - Browser Extensions"
    strings:
        $all_urls     = "\"<all_urls>\""
        $web_request  = "\"webRequest\""
        $tabs         = "\"tabs\""
        $cookies      = "\"cookies\""
        $native_msg   = "\"nativeMessaging\""
    condition:
        $all_urls and (2 of ($web_request, $tabs, $cookies, $native_msg))
}

rule Extension_Supply_Chain_Remote_Script {
    meta:
        description = "Detects extension dynamically loading scripts from external domains"
        severity = "CRITICAL"
        mitre = "T1195.002 - Supply Chain Compromise: Compromise Software Supply Chain"
    strings:
        $create_script = "createElement('script')" nocase
        $create_script2 = "createElement(\"script\")" nocase
        $external_src  = /\.src\s*=\s*['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/ nocase
        $import_call   = /import\s*\(\s*['"`]https?:\/\// nocase
    condition:
        ($create_script or $create_script2) and $external_src
        or $import_call
}

rule Extension_Process_Communication_Abuse {
    meta:
        description = "Detects extension using runtime messaging to forward sensitive page data"
        severity = "HIGH"
        mitre = "T1056.004 - Input Capture"
    strings:
        $send_msg     = "chrome.runtime.sendMessage" nocase
        $post_msg     = "window.postMessage" nocase
        $pw_read      = /input.*password.*\.value/ nocase
        $token_read   = /localStorage\.getItem\s*\(\s*['"`][^'"]+token/ nocase
    condition:
        ($send_msg or $post_msg) and ($pw_read or $token_read)
}

rule Extension_Persistence_Storage_Accumulation {
    meta:
        description = "Detects excessive storage writes — pattern consistent with data harvesting"
        severity = "MEDIUM"
        mitre = "T1119 - Automated Collection"
    strings:
        $storage_set  = "chrome.storage.local.set" nocase
        $indexed_db   = "indexedDB.open" nocase
        $loop_store   = /setInterval[^}]+storage\.(local|sync)\.set/ nocase
    condition:
        $loop_store or (2 of ($storage_set, $indexed_db))
}
