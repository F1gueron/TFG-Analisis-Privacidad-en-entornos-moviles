/**
 * ========================================================================
 * FRIDA UNIFIED BYPASS SCRIPT
 * ========================================================================
 *
 * Comprehensive Frida script for Android traffic analysis research.
 * Bypasses SSL pinning, root detection, emulator detection, and
 * anti-instrumentation checks across 40+ libraries and frameworks.
 *
 * Credits (techniques integrated from):
 *   @fdciabdul, @akabe1, @pcipolloni, @TheDauntless, @Eltion,
 *   @poseidontor, @dzonerzy, @jerry, @ub3rsick, @x90nopslide,
 *   @pimterry (httptoolkit/frida-interception-and-unpinning)
 *
 * Developed by @Figueron for his Bachelor's Thesis.
 *   - jfiguerasmarquez@gmail.com
 *   - https://github.com/F1gueron
 *
 * ========================================================================
 */

// ========================================================================
// GLOBAL CONFIGURATION
// ========================================================================

var commonPaths = [
    "/data/local/bin/su", "/data/local/su", "/data/local/xbin/su",
    "/dev/com.koushikdutta.superuser.daemon/", "/sbin/su",
    "/system/app/Superuser.apk", "/system/bin/failsafe/su",
    "/system/bin/su", "/su/bin/su", "/system/etc/init.d/99SuperSUDaemon",
    "/system/sd/xbin/su", "/system/xbin/busybox", "/system/xbin/daemonsu",
    "/system/xbin/su", "/system/sbin/su", "/vendor/bin/su",
    "/cache/su", "/data/su", "/dev/su", "/system/bin/.ext/su",
    "/system/usr/we-need-root/su", "/system/app/Kinguser.apk",
    "/data/adb/magisk", "/sbin/.magisk", "/cache/.disable_magisk",
    "/dev/.magisk.unblock", "/cache/magisk.log", "/data/adb/magisk.img",
    "/data/adb/magisk.db", "/data/adb/magisk_simple", "/init.magisk.rc",
    "/system/xbin/ku.sud", "/data/adb/ksu", "/data/adb/ksud",
];

var ROOTmanagementApp = [
    "com.noshufou.android.su", "com.noshufou.android.su.elite",
    "eu.chainfire.supersu", "com.koushikdutta.superuser",
    "com.thirdparty.superuser", "com.yellowes.su",
    "com.koushikdutta.rommanager", "com.koushikdutta.rommanager.license",
    "com.dimonvideo.luckypatcher", "com.chelpus.lackypatch",
    "com.ramdroid.appquarantine", "com.ramdroid.appquarantinepro",
    "com.topjohnwu.magisk", "me.weishu.kernelsu",
    "com.devadvance.rootcloak", "com.devadvance.rootcloakplus",
    "de.robv.android.xposed.installer", "com.saurik.substrate",
    "com.zachspong.temprootremovejb", "com.amphoras.hidemyroot",
    "com.amphoras.hidemyrootadfree", "com.formyhm.hiderootPremium",
    "com.formyhm.hideroot", "me.phh.superuser",
    "eu.chainfire.supersu.pro", "com.kingouser.com",
];

var RootProperties = {
    "ro.build.selinux": "1",
    "ro.debuggable": "0",
    "service.adb.root": "0",
    "ro.secure": "1",
};

var RootPropertiesKeys = [];
for (var k in RootProperties) RootPropertiesKeys.push(k);

var caFile = "/data/local/tmp/cacert.crt";

console.log("");
console.log("======================================================");
console.log("[*] FRIDA UNIFIED BYPASS by @Figueron - INITIALIZING...");
console.log("======================================================");
console.log("[*] Using " + caFile + " as file for custom CA injection");
console.log("[*] To change this, modify caFile in this script");
console.log("======================================================");

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

function returner(typeName) {
    if (typeName === undefined || typeName === 'void') return undefined;
    if (typeName === 'boolean') return true;
    if (typeName === 'byte' || typeName === 'short' || typeName === 'int' || typeName === 'long') return 0;
    if (typeName === 'float' || typeName === 'double') return 0.0;
    if (typeName === 'char') return '\u0000';
    return null;
}

function shouldAutoPatchMethod(className, methodName) {
    var full = (className + '.' + methodName).toLowerCase();

    if (className.indexOf('com.appsflyer.') === 0) return false;

    var keywords = [
        'ssl', 'tls', 'x509', 'cert', 'trust', 'pin',
        'handshake', 'hostname', 'checkservertrusted', 'checkclienttrusted',
        'verify', 'peer'
    ];
    for (var i = 0; i < keywords.length; i++) {
        if (full.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
}

function overloader(errStr, targetClass, targetFunc, retType) {
    var tClass = Java.use(targetClass);
    var tFunc = tClass[targetFunc];
    var splittedList = String(errStr).split('.overload');

    for (var n = 1; n < splittedList.length; n++) {
        var extractedOverload = splittedList[n].trim().split('(')[1].slice(0, -1).replace(/'/g, "");
        if (extractedOverload.indexOf('<signature>') !== -1) continue;

        console.log('\x1b[34m[!] Found unusual pinner ' + targetClass + '.' + targetFunc + '(' + extractedOverload + ')\x1b[0m');
        var argList = extractedOverload ? extractedOverload.split(', ') : [];

        try {
            if (argList.length === 0) {
                tFunc.overload().implementation = function () {
                    console.log('\x1b[34m[+] Bypassed unusual pinner\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length === 1) {
                tFunc.overload(argList[0]).implementation = function (a) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length === 2) {
                tFunc.overload(argList[0], argList[1]).implementation = function (a, b) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length === 3) {
                tFunc.overload(argList[0], argList[1], argList[2]).implementation = function (a, b, c) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length === 4) {
                tFunc.overload(argList[0], argList[1], argList[2], argList[3]).implementation = function (a, b, c, d) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            }
        } catch (e) {}
    }
}

// Safely hook all overloads of a method
function hookAllOverloads(className, methodName, returnHandler) {
    try {
        var cls = Java.use(className);
        var method = cls[methodName];
        if (!method || !method.overloads) return false;

        method.overloads.forEach(function (overload) {
            overload.implementation = function () {
                console.log('[+] ' + className + '.' + methodName + ' bypassed');
                if (returnHandler) return returnHandler.apply(this, arguments);
                var retType = overload.returnType.type;
                return returner(retType);
            };
        });
        console.log('[+] All overloads of ' + className + '.' + methodName + ' hooked');
        return true;
    } catch (e) {
        return false;
    }
}

// ========================================================================
// BYPASS EMULATOR DETECTION
// ========================================================================

Java.perform(function () {
    console.log("[*] Bypassing Emulator Detection...");

    // Fake build properties (Samsung Galaxy S7 Edge)
    try {
        var Build = Java.use("android.os.Build");
        Build.PRODUCT.value = "gracerltexx";
        Build.MANUFACTURER.value = "samsung";
        Build.BRAND.value = "samsung";
        Build.DEVICE.value = "gracerlte";
        Build.MODEL.value = "SM-N935F";
        Build.HARDWARE.value = "samsungexynos8890";
        Build.FINGERPRINT.value = "samsung/gracerltexx/gracerlte:8.0.0/R16NW/N935FXXS4BRK2:user/release-keys";
        console.log("[+] Build properties modified");
    } catch (err) {}

    // Hide emulator files
    try {
        Java.use("java.io.File").exists.implementation = function () {
            var name = Java.use("java.io.File").getName.call(this);
            if (["qemud", "qemu_pipe", "drivers", "cpuinfo"].indexOf(name) > -1) {
                console.log("[+] Hiding emulator pipe: " + name);
                return false;
            }
            return this.exists.call(this);
        };
    } catch (err) {}

    // Hide emulator packages
    try {
        Java.use("android.app.ApplicationPackageManager")
            .getPackageInfo.overload("java.lang.String", "int")
            .implementation = function (name, flag) {
                if (["com.example.android.apis", "com.android.development"].indexOf(name) > -1) {
                    console.log("[+] Renaming emulator package: " + name);
                    name = "fake.package.name";
                }
                return this.getPackageInfo.call(this, name, flag);
            };
    } catch (err) {}

    // Native hook for cpuFamily (Android 11+)
    try {
        Interceptor.attach(Module.findGlobalExportByName(null, "android_getCpuFamily"), {
            onLeave: function (retval) {
                if ([2, 5].indexOf(retval) > -1) {
                    retval.replace(4);
                    console.log("[+] CPU family changed to ARM64");
                }
            },
        });
    } catch (err) {}
});

// ========================================================================
// BYPASS ROOT DETECTION
// ========================================================================
setTimeout(function () {
    console.log("[*] Bypassing Root Detection...");

    // Hook access() to prevent detection of su binaries and known root paths
    var accessAddr = Process.getModuleByName('libc.so').findExportByName('access');
    if (accessAddr) {
        try {
            Interceptor.attach(accessAddr, {
                onEnter: function (args) {
                    this.inputPath = args[0].readUtf8String();
                },
                onLeave: function (retval) {
                    if (retval.toInt32() === 0 && commonPaths.indexOf(this.inputPath) >= 0) {
                        console.log("[+] access blocked: " + this.inputPath);
                        retval.replace(ptr(-1));
                    }
                },
            });
            console.log("[+] access hooked");
        } catch (e) {
            console.log("[-] access hook failed: " + e);
        }
    }

    // Hook stat/lstat to hide root files at native level
    ['stat', 'lstat', 'stat64', 'lstat64', 'fstatat64'].forEach(function (funcName) {
        try {
            var addr = Module.findExportByName('libc.so', funcName);
            if (addr) {
                Interceptor.attach(addr, {
                    onEnter: function (args) {
                        try {
                            this.path = args[0].readUtf8String();
                        } catch (e) {
                            this.path = null;
                        }
                    },
                    onLeave: function (retval) {
                        if (this.path && commonPaths.indexOf(this.path) >= 0) {
                            console.log("[+] " + funcName + " blocked: " + this.path);
                            retval.replace(ptr(-1));
                        }
                    }
                });
            }
        } catch (e) {}
    });

    // Hook open/openat to prevent reading root-related files
    try {
        var openAddr = Module.findExportByName('libc.so', 'open');
        if (openAddr) {
            Interceptor.attach(openAddr, {
                onEnter: function (args) {
                    try {
                        this.path = args[0].readUtf8String();
                    } catch (e) {
                        this.path = null;
                    }
                },
                onLeave: function (retval) {
                    if (this.path && commonPaths.indexOf(this.path) >= 0) {
                        console.log("[+] open blocked: " + this.path);
                        retval.replace(ptr(-1));
                    }
                }
            });
        }
    } catch (e) {}

    // Hook __system_property_get to spoof build properties (fingerprint, tags)
    var sysPropAddr = Process.getModuleByName('libc.so').findExportByName('__system_property_get');
    if (sysPropAddr) {
        try {
            Interceptor.attach(sysPropAddr, {
                onEnter: function (args) {
                    this.key = args[0].readCString();
                    this.ret = args[1];
                },
                onLeave: function (ret) {
                    if (this.key === "ro.build.fingerprint") {
                        var tmp = "google/crosshatch/crosshatch:10/QQ3A.200805.001/6578210:user/release-keys";
                        var p = Memory.allocUtf8String(tmp);
                        Memory.copy(this.ret, p, tmp.length + 1);
                    } else if (this.key === "ro.build.tags") {
                        var tmp = "release-keys";
                        var p = Memory.allocUtf8String(tmp);
                        Memory.copy(this.ret, p, tmp.length + 1);
                    }
                },
            });
            console.log("[+] __system_property_get hooked");
        } catch (e) {
            console.log("[-] __system_property_get hook failed: " + e);
        }
    }

    // Hook system() to block root-check commands
    var systemAddr = Process.getModuleByName('libc.so').findExportByName('system');
    if (systemAddr) {
        try {
            Interceptor.attach(systemAddr, {
                onEnter: function (args) {
                    var cmd = Memory.readCString(args[0]);
                    if (cmd.indexOf("su") !== -1 || cmd.indexOf("getprop") !== -1 ||
                        cmd.indexOf("mount") !== -1 || cmd.indexOf("id") !== -1) {
                        console.log("[+] system() blocked: " + cmd);
                        Memory.writeUtf8String(args[0], "grep");
                    }
                },
            });
            console.log("[+] system hooked");
        } catch (e) {
            console.log("[-] system hook failed: " + e);
        }
    }

    // Java hooks
    Java.perform(function () {
        console.log("[*] Root detection: starting Java hooks...");
        // Spoof Build.TAGS and Build.FINGERPRINT
        try {
            var Build = Java.use("android.os.Build");
            Build.TAGS.value = "release-keys";
            Build.FINGERPRINT.value = "google/crosshatch/crosshatch:10/QQ3A.200805.001/6578210:user/release-keys";
            console.log("[+] Build.TAGS and Build.FINGERPRINT spoofed");
        } catch (e) {}

        // Hide root management apps
        try {
            Java.use("android.app.ApplicationPackageManager")
                .getPackageInfo.overload("java.lang.String", "int")
                .implementation = function (str, i) {
                    if (ROOTmanagementApp.indexOf(str) >= 0) {
                        console.log("[+] Hiding package: " + str);
                        str = "fake.package.name";
                    }
                    return this.getPackageInfo(str, i);
                };
        } catch (e) {}

        // Block root checks via Runtime.exec
        try {
            console.log("[*] Blocking root checks via runtime.exe")
            var Runtime = Java.use("java.lang.Runtime");
            var exec1 = Runtime.exec.overload("java.lang.String");
            var exec2 = Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;");
            var exec3 = Runtime.exec.overload("[Ljava.lang.String;", "[Ljava.lang.String;");
            var exec4 = Runtime.exec.overload("[Ljava.lang.String;", "[Ljava.lang.String;", "java.io.File");
            var exec5 = Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;", "java.io.File");

            var execHandler = function (args, isArray) {
                var cmd = args[0];
                var cmdStr = isArray ? cmd.join(' ') : cmd;
                if (cmdStr.indexOf("su") !== -1 || cmdStr.indexOf("getprop") !== -1 || cmdStr.indexOf("mount") !== -1) {
                    console.log("[+] Blocking exec: " + cmdStr);
                    return exec1.call(this, "grep");
                }
                return null;
            };

            exec1.implementation = function (cmd) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec1.call(this, cmd);
            };
            exec2.implementation = function (cmd, env) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec2.call(this, cmd, env);
            };
            exec3.implementation = function (cmd, env) {
                var result = execHandler.call(this, arguments, true);
                return result ? result : exec3.call(this, cmd, env);
            };
            exec4.implementation = function (cmd, env, file) {
                var result = execHandler.call(this, arguments, true);
                return result ? result : exec4.call(this, cmd, env, file);
            };
            exec5.implementation = function (cmd, env, file) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec5.call(this, cmd, env, file);
            };
        } catch (e) {}
        console.log("[*] Root detection: Runtime.exec hooks done, continuing...");

        // Spoof root-related properties via SystemProperties.get
        try {
            Java.use("android.os.SystemProperties")
                .get.overload("java.lang.String")
                .implementation = function (name) {
                    if (RootPropertiesKeys.indexOf(name) !== -1) {
                        console.log("[+] Spoofing property: " + name);
                        return RootProperties[name];
                    }
                    return this.get.call(this, name);
                };
        } catch (e) {}

        // Patch BufferedReader.readLine to hide root indicators in build.prop
        try {
            var BufferedReader = Java.use("java.io.BufferedReader");
            var origReadLine = BufferedReader.readLine.overload();
            origReadLine.implementation = function () {
                var line = origReadLine.call(this);
                if (line && line.indexOf("ro.build.tags=test-keys") !== -1) {
                    console.log("[+] Patching build.prop line: test-keys -> release-keys");
                    line = "ro.build.tags=release-keys";
                }
                return line;
            };
            console.log("[+] BufferedReader.readLine hooked (fixed)");
        } catch (e) {}

        // Prevent app from killing itself on detection
        try {
            Java.use("android.os.Process").killProcess.implementation = function (pid) {
                console.log("[+] Blocked Process.killProcess(" + pid + ")");
            };
        } catch (e) {}

        try {
            Java.use("java.lang.System").exit.implementation = function (code) {
                console.log("[+] Blocked System.exit(" + code + ")");
            };
        } catch (e) {}

        try {
            Java.use("java.lang.Runtime").exit.implementation = function (code) {
                console.log("[+] Blocked Runtime.exit(" + code + ")");
            };
        } catch (e) {}

        // RootBeer library bypass
        console.log("[*] Root detection: hooking RootBeer...");
        try {
            var RootBeer = Java.use('com.scottyab.rootbeer.RootBeer');
            RootBeer.isRooted.implementation = function () { console.log('[+] RootBeer.isRooted bypassed'); return false; };
            RootBeer.isRootedWithoutBusyBoxCheck.implementation = function () { return false; };
            RootBeer.isRootedWithBusyBoxCheck.implementation = function () { return false; };
            RootBeer.detectTestKeys.implementation = function () { return false; };
            RootBeer.checkForSuBinary.implementation = function () { return false; };
            RootBeer.checkForMagiskBinary.implementation = function () { return false; };
            RootBeer.checkForBusyBoxBinary.implementation = function () { return false; };
            RootBeer.checkForDangerousProps.implementation = function () { return false; };
            RootBeer.checkForRWPaths.implementation = function () { return false; };
            RootBeer.checkSuExists.implementation = function () { return false; };
            RootBeer.checkForNativeLibraryReadAccess.implementation = function () { return false; };
            RootBeer.canLoadNativeLibrary.implementation = function () { return false; };
            RootBeer.checkForRootNative.implementation = function () { return false; };
            RootBeer.detectRootManagementApps.overload().implementation = function () { return false; };
            RootBeer.detectPotentiallyDangerousApps.overload().implementation = function () { return false; };
            RootBeer.detectRootCloakingApps.overload().implementation = function () { return false; };
            RootBeer.detectRootManagementApps.overload('[Ljava.lang.String;').implementation = function (a) { return false; };
            RootBeer.detectPotentiallyDangerousApps.overload('[Ljava.lang.String;').implementation = function (a) { return false; };
            RootBeer.detectRootCloakingApps.overload('[Ljava.lang.String;').implementation = function (a) { return false; };
            RootBeer.checkForBinary.implementation = function (str) { return false; };
            console.log('[+] RootBeer library fully bypassed');
        } catch (e) {}

        // RootBeer native detection bypass
        try {
            var RootBeerNative = Java.use('com.scottyab.rootbeer.RootBeerNative');
            RootBeerNative.checkForRoot.overload().implementation = function () { return 0; };
            RootBeerNative.checkForRoot.overload('[Ljava.lang.Object;').implementation = function (a) { return 0; };
            console.log('[+] RootBeerNative bypassed');
        } catch (e) {}

        console.log("[+] Root detection bypasses initialized");
    });
}, 1500);

// ========================================================================
// SSL PINNING BYPASS
// ========================================================================

setTimeout(function () {
    Java.perform(function () {
        console.log("[*] Bypassing SSL Pinning...");

        // -- TrustedCertificateIndex CA injection --
        
        var caCert = null;
        try {
            var cf = Java.use("java.security.cert.CertificateFactory").getInstance("X.509");
            var caFis = Java.use("java.io.FileInputStream").$new(caFile);
            var caBis = Java.use("java.io.BufferedInputStream").$new(caFis);
            caCert = cf.generateCertificate(caBis);
            caBis.close();

            var trustedClasses = [
                "com.android.org.conscrypt.TrustedCertificateIndex",
                "org.conscrypt.TrustedCertificateIndex",
                "org.apache.harmony.xnet.provider.jsse.TrustedCertificateIndex"
            ];
            trustedClasses.forEach(function (className) {
                try {
                    var TCI = Java.use(className);
                    TCI.$init.overloads.forEach(function (overload) {
                        var orig = overload;
                        orig.implementation = function () {
                            orig.apply(this, arguments);
                            try { this.index(caCert); } catch (e) {}
                        };
                    });
                    if (TCI.reset) {
                        TCI.reset.overloads.forEach(function (overload) {
                            var orig2 = overload;
                            orig2.implementation = function () {
                                orig2.apply(this, arguments);
                                try { this.index(caCert); } catch (e) {}
                            };
                        });
                    }
                    console.log('[+] TrustedCertificateIndex injected (' + className + ')');
                } catch (e) {}
            });
        } catch (e) {
            console.log("[-] TrustedCertificateIndex injection skipped (CA not found)");
        }

        // -- Unified SSLContext.init bypass --
        
        try {
            var CertificateFactory = Java.use("java.security.cert.CertificateFactory");
            var KeyStore = Java.use("java.security.KeyStore");
            var TrustManagerFactory = Java.use("javax.net.ssl.TrustManagerFactory");
            var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
            var SSLContext = Java.use('javax.net.ssl.SSLContext');

            var proxyTmf = null;
            try {
                var cf2 = CertificateFactory.getInstance("X.509");
                var fis = Java.use("java.io.FileInputStream").$new(caFile);
                var bis = Java.use("java.io.BufferedInputStream").$new(fis);
                var ca = cf2.generateCertificate(bis);
                bis.close();

                var ks = KeyStore.getInstance(KeyStore.getDefaultType());
                ks.load(null, null);
                ks.setCertificateEntry("mitm", ca);

                proxyTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                proxyTmf.init(ks);
                console.log("[+] Proxy CA TrustManagerFactory initialized");
            } catch (e) {
                console.log("[-] Proxy CA not loaded, using permissive-only TrustManager");
            }

            var PermissiveTM = Java.registerClass({
                name: 'dev.asd.test.TrustManager',
                implements: [X509TrustManager],
                methods: {
                    checkClientTrusted: function (chain, authType) {},
                    checkServerTrusted: function (chain, authType) {},
                    getAcceptedIssuers: function () { return []; }
                }
            });

            SSLContext.init.overload(
                '[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom'
            ).implementation = function (km, tm, sr) {
                console.log('[+] SSLContext.init intercepted');
                
                var trustManagers;
                if (proxyTmf !== null) {
                    trustManagers = proxyTmf.getTrustManagers();
                } else {
                    trustManagers = [PermissiveTM.$new()];
                }
                this.init(km, trustManagers, sr);
            };
            console.log("[+] SSLContext.init unified bypass installed");
        } catch (err) {
            console.log("[-] SSLContext.init bypass failed: " + err);
        }

        // -- HttpsURLConnection --
        try {
            var HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
            HttpsURLConnection.setDefaultHostnameVerifier.implementation = function (hv) {
                console.log("[+] HttpsURLConnection bypassed");
            };
            HttpsURLConnection.setSSLSocketFactory.implementation = function (sf) {
                console.log("[+] HttpsURLConnection SSLFactory bypassed");
            };
            HttpsURLConnection.setHostnameVerifier.implementation = function (hv) {
                console.log("[+] HttpsURLConnection HostnameVerifier bypassed");
            };
        } catch (err) {}

        // -- OkHTTP3 CertificatePinner --
        ['java.util.List', 'java.security.cert.Certificate', '[Ljava.security.cert.Certificate;'].forEach(function (type, idx) {
            try {
                Java.use('okhttp3.CertificatePinner')
                    .check.overload('java.lang.String', type)
                    .implementation = function (a, b) {
                        console.log('[+] OkHTTP3 {' + (idx + 1) + '} bypassed: ' + a);
                    };
            } catch (err) {}
        });

        try {
            Java.use('okhttp3.CertificatePinner')
                .check$okhttp.overload('java.lang.String', 'kotlin.jvm.functions.Function0')
                .implementation = function (a, b) {
                    console.log('[+] OkHTTP3 {4} bypassed: ' + a);
                };
        } catch (err) {}

        // -- OkHttp3 OkHostnameVerifier --
        try {
            Java.use('okhttp3.internal.tls.OkHostnameVerifier')
                .verify.overload('java.lang.String', 'javax.net.ssl.SSLSession')
                .implementation = function (host, session) {
                    console.log('[+] OkHttp3 OkHostnameVerifier {1} bypassed: ' + host);
                    return true;
                };
        } catch (err) {}

        try {
            Java.use('okhttp3.internal.tls.OkHostnameVerifier')
                .verify.overload('java.lang.String', 'java.security.cert.X509Certificate')
                .implementation = function (host, cert) {
                    console.log('[+] OkHttp3 OkHostnameVerifier {2} bypassed: ' + host);
                    return true;
                };
        } catch (err) {}

        // -- OkHttp3 CertificatePinner.Builder --
        try {
            Java.use('okhttp3.CertificatePinner$Builder').add.implementation = function (hostname, pins) {
                console.log('[+] OkHttp3 CertificatePinner.Builder.add blocked: ' + hostname);
                return this;
            };
        } catch (err) {}
        console.log("[*] OkHttp3 hooks done, continuing...");

        // -- OkHttp3 RealConnection
        try {
            Java.use('okhttp3.internal.connection.RealConnection')
                .connectTls.implementation = function (connectionSpecSelector) {
                    console.log('[+] OkHttp3 RealConnection.connectTls intercepted');
                    return this.connectTls(connectionSpecSelector);
                };
        } catch (err) {}

        // -- OkHttp3 Platform
        
        try {
            var platform = Java.use('okhttp3.internal.platform.Platform');
            platform.trustManager.implementation = function (factory) {
                console.log('[+] OkHttp3 Platform.trustManager intercepted');
                return this.trustManager(factory);
            };
        } catch (err) {}

        try {
            Java.use('okhttp3.internal.platform.ConscryptPlatform')
                .trustManager.implementation = function (factory) {
                    console.log('[+] OkHttp3 ConscryptPlatform.trustManager intercepted');
                    return this.trustManager(factory);
                };
        } catch (err) {}

        try {
            Java.use('okhttp3.internal.platform.Android10Platform')
                .trustManager.implementation = function (factory) {
                    console.log('[+] OkHttp3 Android10Platform.trustManager intercepted');
                    return this.trustManager(factory);
                };
        } catch (err) {}

        // -- OkHttp3 RealCall --
        try {
            Java.use("okhttp3.internal.connection.RealCall")
                .getResponseWithInterceptorChain.implementation = function () {
                    console.log("[+] OkHttp RealCall.getResponseWithInterceptorChain");
                    return this.getResponseWithInterceptorChain();
                };
        } catch (e) {}

        // -- gRPC OkHttpChannelBuilder --
        try {
            Java.use("io.grpc.okhttp.OkHttpChannelBuilder")
                .sslSocketFactory.overload("javax.net.ssl.SSLSocketFactory")
                .implementation = function (sf) {
                    console.log("[+] gRPC OkHttpChannelBuilder sslSocketFactory bypass");
                    return this.sslSocketFactory(sf);
                };
        } catch (e) {}

        // -- Google Play Services internal pinning --
        try {
            var GoogleApiClient = Java.use("com.google.android.gms.common.internal.zal");
            var methods = GoogleApiClient.class.getDeclaredMethods();
            methods.forEach(function (m) {
                if (m.getName() === "zaa") {
                    var overloadCount = GoogleApiClient["zaa"].overloads.length;
                    for (var i = 0; i < overloadCount; i++) {
                        GoogleApiClient["zaa"].overloads[i].implementation = function () {
                            console.log("[+] GoogleApiClient.zaa (Play Services) bypassed");
                            return this["zaa"].apply(this, arguments);
                        };
                    }
                }
            });
        } catch (e) {}

        // -- Google Play Services pinning via common obfuscated classes --

        // -- TrustKit --
        try {
            var tk = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
            tk.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) {
                console.log('[+] Trustkit {1}: ' + a); return true;
            };
            tk.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) {
                console.log('[+] Trustkit {2}: ' + a); return true;
            };
        } catch (err) {}

        try {
            Java.use('com.datatheorem.android.trustkit.pinning.PinningTrustManager')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function () {
                    console.log('[+] Trustkit PinningTrustManager bypassed');
                };
        } catch (err) {}

        // -- TrustManagerImpl (AOSP Conscrypt, Android > 7) --
        try {
            var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
            TrustManagerImpl.checkTrustedRecursive.implementation = function () {
                console.log('[+] TrustManagerImpl checkTrustedRecursive bypassed');
                return Java.use("java.util.ArrayList").$new();
            };
        } catch (err) {}

        try {
            Java.use('com.android.org.conscrypt.TrustManagerImpl')
                .verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
                    console.log('[+] TrustManagerImpl verifyChain bypassed: ' + host);
                    return untrustedChain;
                };
        } catch (err) {}

        try {
            Java.use('com.android.org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log('[+] TrustManagerImpl checkServerTrusted bypassed');
                };
        } catch (err) {}

        try {
            Java.use('com.android.org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log('[+] TrustManagerImpl checkServerTrusted (3-arg) bypassed: ' + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (err) {}

        // -- TrustManagerImpl.checkTrusted (internal method, all overloads) --
        // Core internal method on Android 7+
        console.log("[*] Hooking TrustManagerImpl variants...");
        var tmImplClasses = [
            'com.android.org.conscrypt.TrustManagerImpl',
            'org.conscrypt.TrustManagerImpl',
            'com.google.android.gms.org.conscrypt.TrustManagerImpl'
        ];
        tmImplClasses.forEach(function (tmClass) {
            try {
                var cls = Java.use(tmClass);
                if (cls.checkTrusted) {
                    cls.checkTrusted.overloads.forEach(function (overload) {
                        overload.implementation = function () {
                            console.log('[+] ' + tmClass + '.checkTrusted bypassed');
                            return Java.use("java.util.ArrayList").$new();
                        };
                    });
                    console.log('[+] ' + tmClass + '.checkTrusted all overloads hooked');
                }
            } catch (e) {}
        });

        // -- TrustManagerImpl.checkServerTrusted with Socket/SSLEngine overloads --
        
        tmImplClasses.forEach(function (tmClass) {
            // Socket overload
            try {
                Java.use(tmClass)
                    .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.net.Socket')
                    .implementation = function (chain, authType, socket) {
                        console.log('[+] ' + tmClass + '.checkServerTrusted (Socket) bypassed');
                        return Java.use("java.util.ArrayList").$new();
                    };
            } catch (e) {}
            // SSLEngine overload
            try {
                Java.use(tmClass)
                    .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'javax.net.ssl.SSLEngine')
                    .implementation = function (chain, authType, engine) {
                        console.log('[+] ' + tmClass + '.checkServerTrusted (SSLEngine) bypassed');
                        return Java.use("java.util.ArrayList").$new();
                    };
            } catch (e) {}
        });

        // -- X509TrustManagerExtensions bypass --
        // Android 7+ additional cert checks
        try {
            Java.use('android.net.http.X509TrustManagerExtensions')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log('[+] X509TrustManagerExtensions.checkServerTrusted bypassed: ' + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (err) {}

        // -- X509ExtendedTrustManager bypass --

        // -- Standalone Conscrypt library (org.conscrypt.*) --
        try {
            Java.use('org.conscrypt.TrustManagerImpl')
                .verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
                    console.log('[+] org.conscrypt verifyChain bypassed: ' + host);
                    return untrustedChain;
                };
        } catch (err) {}

        try {
            Java.use('org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log('[+] org.conscrypt checkServerTrusted bypassed');
                };
        } catch (err) {}

        try {
            Java.use('org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log('[+] org.conscrypt checkServerTrusted (3-arg) bypassed: ' + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (err) {}

        try {
            Java.use('org.conscrypt.OpenSSLSocketImpl').verifyCertificateChain.implementation = function () {
                console.log('[+] org.conscrypt OpenSSLSocketImpl bypassed');
            };
        } catch (err) {}

        try {
            Java.use('org.conscrypt.ConscryptEngineSocket').verifyCertificateChain.implementation = function () {
                console.log('[+] org.conscrypt ConscryptEngineSocket bypassed');
            };
        } catch (err) {}

        // -- ConscryptFileDescriptorSocket.verifyCertificateChain --
        
        console.log("[*] Hooking Conscrypt socket implementations...");
        var conscryptSocketClasses = [
            'com.android.org.conscrypt.ConscryptFileDescriptorSocket',
            'org.conscrypt.ConscryptFileDescriptorSocket',
            'com.google.android.gms.org.conscrypt.ConscryptFileDescriptorSocket'
        ];
        conscryptSocketClasses.forEach(function (cls) {
            try {
                Java.use(cls).verifyCertificateChain.implementation = function () {
                    console.log('[+] ' + cls + '.verifyCertificateChain bypassed');
                };
                console.log('[+] ' + cls + ' hooked');
            } catch (e) {}
        });

        // -- AbstractConscryptSocket verification --
        var abstractConscryptClasses = [
            'com.android.org.conscrypt.AbstractConscryptSocket',
            'org.conscrypt.AbstractConscryptSocket',
            'com.google.android.gms.org.conscrypt.AbstractConscryptSocket'
        ];
        abstractConscryptClasses.forEach(function (cls) {
            try {
                var acsClass = Java.use(cls);
                if (acsClass.verifyCertificateChain) {
                    acsClass.verifyCertificateChain.overloads.forEach(function (overload) {
                        overload.implementation = function () {
                            console.log('[+] ' + cls + '.verifyCertificateChain bypassed');
                        };
                    });
                }
            } catch (e) {}
        });

        // -- Google Play Services Conscrypt (com.google.android.gms.org.conscrypt.*) --
        try {
            Java.use('com.google.android.gms.org.conscrypt.TrustManagerImpl')
                .verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
                    console.log('[+] GMS Conscrypt verifyChain bypassed: ' + host);
                    return untrustedChain;
                };
        } catch (err) {}

        try {
            Java.use('com.google.android.gms.org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log('[+] GMS Conscrypt checkServerTrusted bypassed');
                };
        } catch (err) {}

        try {
            Java.use('com.google.android.gms.org.conscrypt.TrustManagerImpl')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log('[+] GMS Conscrypt checkServerTrusted (3-arg) bypassed: ' + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (err) {}

        try {
            Java.use('com.google.android.gms.org.conscrypt.OpenSSLSocketImpl').verifyCertificateChain.implementation = function () {
                console.log('[+] GMS OpenSSLSocketImpl bypassed');
            };
        } catch (err) {}

        try {
            Java.use('com.google.android.gms.org.conscrypt.OpenSSLEngineSocketImpl').verifyCertificateChain.implementation = function () {
                console.log('[+] GMS OpenSSLEngineSocketImpl bypassed');
            };
        } catch (err) {}

        // -- Appcelerator --
        try {
            Java.use('appcelerator.https.PinningTrustManager').checkServerTrusted.implementation = function () {
                console.log('[+] Appcelerator bypassed');
            };
        } catch (err) {}

        // -- Fabric SDK PinningTrustManager --
        try {
            Java.use('io.fabric.sdk.android.services.network.PinningTrustManager').checkServerTrusted.implementation = function () {
                console.log('[+] Fabric SDK PinningTrustManager bypassed');
            };
        } catch (err) {}

        // -- AOSP Conscrypt OpenSSLSocketImpl --
        try {
            Java.use('com.android.org.conscrypt.OpenSSLSocketImpl').verifyCertificateChain.implementation = function () {
                console.log('[+] OpenSSLSocketImpl Conscrypt bypassed');
            };
        } catch (err) {}

        // -- AOSP Conscrypt OpenSSLEngineSocketImpl --
        try {
            Java.use('com.android.org.conscrypt.OpenSSLEngineSocketImpl')
                .verifyCertificateChain.overload('[Ljava.lang.Long;', 'java.lang.String')
                .implementation = function (a, b) {
                    console.log('[+] OpenSSLEngineSocketImpl bypassed: ' + b);
                };
        } catch (err) {}

        // -- Apache Harmony --
        try {
            Java.use('org.apache.harmony.xnet.provider.jsse.OpenSSLSocketImpl').verifyCertificateChain.implementation = function () {
                console.log('[+] Apache Harmony bypassed');
            };
        } catch (err) {}

        // -- PhoneGap --
        try {
            Java.use('nl.xservices.plugins.sslCertificateChecker')
                .execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext')
                .implementation = function (a, b, c) {
                    console.log('[+] PhoneGap bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        // -- IBM MobileFirst --
        try {
            var wlclient = Java.use('com.worklight.wlclient.api.WLClient').getInstance();
            wlclient.pinTrustedCertificatePublicKey.overload('java.lang.String').implementation = function (cert) {
                console.log('[+] IBM MobileFirst {1} bypassed');
            };
            wlclient.pinTrustedCertificatePublicKey.overload('[Ljava.lang.String;').implementation = function (cert) {
                console.log('[+] IBM MobileFirst {2} bypassed');
            };
        } catch (err) {}

        // -- IBM WorkLight --
        try {
            var wl = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
            wl.verify.overload('java.lang.String', 'javax.net.ssl.SSLSocket').implementation = function (a, b) { console.log('[+] WorkLight {1}: ' + a); };
            wl.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) { console.log('[+] WorkLight {2}: ' + a); };
            wl.verify.overload('java.lang.String', '[Ljava.lang.String;', '[Ljava.lang.String;').implementation = function (a, b) { console.log('[+] WorkLight {3}: ' + a); };
            wl.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) { console.log('[+] WorkLight {4}: ' + a); return true; };
        } catch (err) {}

        // -- Conscrypt CertPinManager --
        try {
            Java.use('com.android.org.conscrypt.CertPinManager')
                .checkChainPinning.overload('java.lang.String', 'java.util.List')
                .implementation = function (a, b) {
                    console.log('[+] Conscrypt CertPinManager bypassed: ' + a);
                };
        } catch (err) {}

        try {
            Java.use('com.android.org.conscrypt.CertPinManager')
                .isChainValid.overload('java.lang.String', 'java.util.List')
                .implementation = function (a, b) {
                    console.log('[+] Conscrypt CertPinManager (Legacy) bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        // -- CWAC-Netsecurity --
        try {
            Java.use('com.commonsware.cwac.netsecurity.conscrypt.CertPinManager')
                .isChainValid.overload('java.lang.String', 'java.util.List')
                .implementation = function (a, b) {
                    console.log('[+] CWAC-Netsecurity bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        // -- Worklight Androidgap --
        try {
            Java.use('com.worklight.androidgap.plugin.WLCertificatePinningPlugin')
                .execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext')
                .implementation = function (a, b, c) {
                    console.log('[+] Worklight Androidgap bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        // -- Netty --
        try {
            Java.use('io.netty.handler.ssl.util.FingerprintTrustManagerFactory').checkTrusted.implementation = function (type, chain) {
                console.log('[+] Netty bypassed');
            };
        } catch (err) {}

        // -- Squareup OkHTTP < v3 --
        try {
            var sq = Java.use('com.squareup.okhttp.CertificatePinner');
            sq.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function (a, b) { console.log('[+] Squareup {1}: ' + a); };
            sq.check.overload('java.lang.String', 'java.util.List').implementation = function (a, b) { console.log('[+] Squareup {2}: ' + a); };
        } catch (err) {}

        try {
            var sqv = Java.use('com.squareup.okhttp.internal.tls.OkHostnameVerifier');
            sqv.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) { console.log('[+] Squareup Verifier {1}: ' + a); return true; };
            sqv.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) { console.log('[+] Squareup Verifier {2}: ' + a); return true; };
        } catch (err) {}

        // -- AOSP bundled OkHttp --
        try {
            var aospHV = Java.use('com.android.okhttp.internal.tls.OkHostnameVerifier');
            aospHV.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) {
                console.log('[+] AOSP OkHttp OkHostnameVerifier {1} bypassed: ' + a);
                return true;
            };
            aospHV.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) {
                console.log('[+] AOSP OkHttp OkHostnameVerifier {2} bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        try {
            Java.use('com.android.okhttp.CertificatePinner')
                .check.overload('java.lang.String', 'java.util.List')
                .implementation = function (a, b) {
                    console.log('[+] AOSP OkHttp CertificatePinner bypassed: ' + a);
                };
        } catch (err) {}

        try {
            Java.use('com.android.okhttp.Address').$init.implementation = function () {
                console.log('[+] AOSP OkHttp Address constructor intercepted');
                return this.$init.apply(this, arguments);
            };
        } catch (err) {}

        // -- Conscrypt CertificateTransparency --
        console.log("[*] Hooking Certificate Transparency...");
        try {
            Java.use('com.android.org.conscrypt.ct.CertificateTransparency').checkCT.implementation = function () {
                console.log('[+] Conscrypt CertificateTransparency.checkCT bypassed');
            };
        } catch (err) {}

        // -- Conscrypt CT Verification --
        var ctClasses = [
            'com.android.org.conscrypt.ct.CTVerifier',
            'org.conscrypt.ct.CTVerifier',
            'com.google.android.gms.org.conscrypt.ct.CTVerifier'
        ];
        ctClasses.forEach(function (cls) {
            try {
                hookAllOverloads(cls, 'verifySignedCertificateTimestamps');
                console.log('[+] ' + cls + '.verifySignedCertificateTimestamps hooked');
            } catch (e) {}
        });

        var ctPolicyClasses = [
            'com.android.org.conscrypt.ct.CTPolicy',
            'org.conscrypt.ct.CTPolicy',
            'com.google.android.gms.org.conscrypt.ct.CTPolicy'
        ];
        ctPolicyClasses.forEach(function (cls) {
            try {
                Java.use(cls).doesResultConformToPolicy.implementation = function () {
                    console.log('[+] ' + cls + '.doesResultConformToPolicy bypassed');
                    return true;
                };
            } catch (e) {}
        });

        // -- Android WebViewClient --
        try {
            var wvc = Java.use('android.webkit.WebViewClient');
            wvc.onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError')
                .implementation = function (v, h, e) {
                    console.log('[+] WebViewClient SSL error bypassed');
                    h.proceed();
                };
            wvc.onReceivedError.implementation = function (view, errCode, description, failingUrl) {
                console.log('[+] WebViewClient error bypassed');
            };
            wvc.onReceivedError.overload('android.webkit.WebView', 'android.webkit.WebResourceRequest', 'android.webkit.WebResourceError')
                .implementation = function (v, r, e) {
                    console.log('[+] WebViewClient resource error bypassed');
                };
        } catch (err) {}

        // -- Apache Cordova --
        try {
            Java.use('org.apache.cordova.CordovaWebViewClient')
                .onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError')
                .implementation = function (v, h, e) {
                    console.log('[+] Apache Cordova bypassed');
                    h.proceed();
                };
        } catch (err) {}

        // -- Boye AbstractVerifier --
        try {
            Java.use('ch.boye.httpclientandroidlib.conn.ssl.AbstractVerifier').verify.implementation = function (host, ssl) {
                console.log('[+] Boye AbstractVerifier bypassed: ' + host);
            };
        } catch (err) {}

        // -- Apache AbstractVerifier --
        try {
            var av = Java.use('org.apache.http.conn.ssl.AbstractVerifier');
            av.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) { console.log('[+] Apache Verifier {1}: ' + a); };
            av.verify.overload('java.lang.String', 'javax.net.ssl.SSLSocket').implementation = function (a, b) { console.log('[+] Apache Verifier {2}: ' + a); };
            av.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) { console.log('[+] Apache Verifier {3}: ' + a); };
            av.verify.overload('java.lang.String', '[Ljava.lang.String;', '[Ljava.lang.String;', 'boolean').implementation = function (a, b, c, d) { console.log('[+] Apache Verifier {4}: ' + a); };
        } catch (err) {}

        // -- Flutter Java plugins --
        try {
            Java.use('diefferson.http_certificate_pinning.HttpCertificatePinning')
                .checkConnexion.overload("java.lang.String", "java.util.List", "java.util.Map", "int", "java.lang.String")
                .implementation = function (a, b, c, d, e) {
                    console.log('[+] Flutter HttpCertificatePinning bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        try {
            Java.use('com.macif.plugin.sslpinningplugin.SslPinningPlugin')
                .checkConnexion.overload("java.lang.String", "java.util.List", "java.util.Map", "int", "java.lang.String")
                .implementation = function (a, b, c, d, e) {
                    console.log('[+] Flutter SslPinningPlugin bypassed: ' + a);
                    return true;
                };
        } catch (err) {}

        // -- Appmattus Certificate Transparency --
        try {
            Java.use('com.appmattus.certificatetransparency.internal.verifier.CertificateTransparencyInterceptor')
                .intercept.implementation = function (a) {
                    console.log('[+] Appmattus Transparency bypassed');
                    return a.proceed(a.request());
                };
        } catch (err) {}

        try {
            var ct = Java.use('com.appmattus.certificatetransparency.internal.verifier.CertificateTransparencyTrustManager');
            ct.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String').implementation = function () {
                console.log('[+] Appmattus TM {1} bypassed');
            };
            ct.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String').implementation = function () {
                console.log('[+] Appmattus TM {2} bypassed');
                return Java.use("java.util.ArrayList").$new();
            };
        } catch (err) {}

        // -- Cronet --
        try {
            var CronetEngineBuilderImpl = Java.use("org.chromium.net.impl.CronetEngineBuilderImpl");
            CronetEngineBuilderImpl.enablePublicKeyPinningBypassForLocalTrustAnchors.implementation = function (bypass) {
                console.log("[+] Cronet Public Key Pinning Bypass forced");
                return this.enablePublicKeyPinningBypassForLocalTrustAnchors(true);
            };
            CronetEngineBuilderImpl.addPublicKeyPins.implementation = function () {
                console.log("[+] Cronet addPublicKeyPins blocked");
                return this;
            };
            console.log("[+] Cronet hooks installed");
        } catch (err) {}

        // -- NativeCronetEngineBuilderImpl --
        try {
            Java.use("org.chromium.net.impl.NativeCronetEngineBuilderImpl")
                .addPublicKeyPins.implementation = function () {
                    console.log("[+] NativeCronetEngineBuilderImpl.addPublicKeyPins blocked");
                    return this;
                };
        } catch (err) {}

        try {
            Java.use("org.chromium.net.impl.NativeCronetEngineBuilderImpl")
                .enablePublicKeyPinningBypassForLocalTrustAnchors.implementation = function (bypass) {
                    console.log("[+] NativeCronetEngineBuilderImpl bypass forced");
                    return this.enablePublicKeyPinningBypassForLocalTrustAnchors(true);
                };
        } catch (err) {}

        // -- CronetUrlRequest pin check --
        try {
            var CronetUrlRequest = Java.use("org.chromium.net.impl.CronetUrlRequest");
            if (CronetUrlRequest.onPinCheckComplete) {
                CronetUrlRequest.onPinCheckComplete.implementation = function (pinVerified) {
                    console.log("[+] CronetUrlRequest.onPinCheckComplete forced true");
                    return this.onPinCheckComplete(true);
                };
            }
        } catch (err) {}

        // -- Network Security Config --
        console.log("[*] Hooking Network Security Config...");
        try {
            Java.use("android.security.net.config.NetworkSecurityConfig")
                .isCleartextTrafficPermitted.overload()
                .implementation = function () {
                    console.log("[+] NSC cleartext allowed");
                    return true;
                };
        } catch (e) {}

        // -- NetworkSecurityConfig.getTrustAnchors --
        
        try {
            Java.use("android.security.net.config.NetworkSecurityConfig")
                .getTrustAnchors.implementation = function () {
                    console.log("[+] NSC getTrustAnchors intercepted");
                    return this.getTrustAnchors();
                };
        } catch (e) {}

        // -- NetworkSecurityPolicy --
        try {
            Java.use("android.security.net.config.NetworkSecurityPolicy")
                .isCleartextTrafficPermitted.overload()
                .implementation = function () {
                    console.log("[+] NetworkSecurityPolicy cleartext allowed");
                    return true;
                };
        } catch (e) {}

        try {
            Java.use("android.security.net.config.NetworkSecurityPolicy")
                .isCleartextTrafficPermitted.overload('java.lang.String')
                .implementation = function (hostname) {
                    console.log("[+] NetworkSecurityPolicy cleartext allowed for: " + hostname);
                    return true;
                };
        } catch (e) {}

        // -- NetworkSecurityTrustManager --
        try {
            Java.use("android.security.net.config.NetworkSecurityTrustManager")
                .checkPins.implementation = function (chain) {
                    console.log("[+] NSC checkPins bypassed");
                };
        } catch (e) {}

        try {
            Java.use("android.security.net.config.NetworkSecurityTrustManager")
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log("[+] NSC checkServerTrusted bypassed");
                };
        } catch (e) {}

        // -- NetworkSecurityTrustManager (3-arg) --
        try {
            Java.use("android.security.net.config.NetworkSecurityTrustManager")
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log("[+] NSC checkServerTrusted (3-arg) bypassed: " + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (e) {}

        // -- RootTrustManager --
        try {
            Java.use("android.security.net.config.RootTrustManager")
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log("[+] RootTrustManager checkServerTrusted bypassed");
                };
        } catch (e) {}

        try {
            Java.use("android.security.net.config.RootTrustManager")
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String')
                .implementation = function (chain, authType, host) {
                    console.log("[+] RootTrustManager checkServerTrusted (3-arg) bypassed: " + host);
                    return Java.use("java.util.ArrayList").$new();
                };
        } catch (e) {}

        // -- ManifestConfigSource --
        try {
            Java.use("android.security.net.config.ManifestConfigSource$DefaultConfigSource")
                .getDefaultConfig.implementation = function () {
                    console.log("[+] NSC DefaultConfigSource bypassed");
                    return this.getDefaultConfig();
                };
        } catch (e) {}

        // -- SSLSocketFactory --
        try {
            Java.use("javax.net.ssl.SSLSocketFactory")
                .createSocket.overload("java.net.Socket", "java.lang.String", "int", "boolean")
                .implementation = function (s, host, port, autoClose) {
                    console.log("[+] SSLSocketFactory.createSocket -> " + host + ":" + port);
                    return this.createSocket(s, host, port, autoClose);
                };
        } catch (e) {}

        // -- Generic HostnameVerifier --
        try {
            var HostnameVerifier = Java.use("javax.net.ssl.HostnameVerifier");
            var AlwaysTrue = Java.registerClass({
                name: "dev.asd.test.AlwaysTrueHostnameVerifier",
                implements: [HostnameVerifier],
                methods: {
                    verify: function (hostname, session) {
                        console.log("[+] HostnameVerifier forced for " + hostname);
                        return true;
                    }
                }
            });
            Java.use("javax.net.ssl.HttpsURLConnection")
                .setDefaultHostnameVerifier.implementation = function (hv) {
                    console.log("[+] setDefaultHostnameVerifier overridden");
                    this.setDefaultHostnameVerifier(AlwaysTrue.$new());
                };
        } catch (e) {}

        // -- Volley / HurlStack --
        try {
            Java.use('com.android.volley.toolbox.HurlStack')
                .createConnection.implementation = function (url) {
                    console.log('[+] Volley HurlStack.createConnection intercepted: ' + url);
                    return this.createConnection(url);
                };
        } catch (err) {}

        // -- Samsung Knox --
        console.log("[*] Hooking Samsung Knox, Unity, AppsFlyer...");
        try {
            Java.use('com.samsung.android.knox.net.vpn.KnoxVpnEngine')
                .isVpnRunning.implementation = function () {
                    console.log('[+] Samsung Knox VPN check bypassed');
                    return false;
                };
        } catch (err) {}

        try {
            hookAllOverloads('com.samsung.android.security.mdf.MdfUtils', 'checkServerTrusted');
        } catch (err) {}

        try {
            hookAllOverloads('com.samsung.android.sdk.net.SemSslPinningHelper', 'checkPins');
        } catch (err) {}

        // -- Unity Services --
        try {
            hookAllOverloads('com.unity3d.services.core.api.Request', 'execute');
        } catch (err) {}

        try {
            Java.use('com.unity3d.services.core.request.WebRequest').makeRequest.implementation = function () {
                console.log('[+] Unity WebRequest.makeRequest intercepted');
                return this.makeRequest.apply(this, arguments);
            };
        } catch (err) {}
        // -- AppsFlyer SDK --
        try {
            hookAllOverloads('com.appsflyer.internal.AFKeystoreWrapper', 'checkServerTrusted');
        } catch (err) {}

        try {
            var afClasses = [
                'com.appsflyer.internal.ah',
                'com.appsflyer.internal.ai',
                'com.appsflyer.internal.aj',
            ];
            afClasses.forEach(function (cls) {
                hookAllOverloads(cls, 'checkServerTrusted');
                hookAllOverloads(cls, 'verify');
            });
        } catch (err) {}
        // -- SafetyNet / Play Integrity --
        try {
            Java.use('com.google.android.gms.safetynet.SafetyNetApi$AttestationResponse')
                .getJwsResult.implementation = function () {
                    console.log('[+] SafetyNet attestation intercepted');
                    return this.getJwsResult();
                };
        } catch (err) {}

        // -- Dynamic SSLPeerUnverifiedException auto-patcher --
        console.log("[*] Installing auto-patchers (SSLPeer, CertException, Handshake)...");
        try {
            Java.use('javax.net.ssl.SSLPeerUnverifiedException').$init.implementation = function (reason) {
                try {
                    var stackTrace = Java.use('java.lang.Thread').currentThread().getStackTrace();
                    var exceptionStackIndex = -1;
                    for (var si = 0; si < stackTrace.length; si++) {
                        if (stackTrace[si].getClassName() === "javax.net.ssl.SSLPeerUnverifiedException") {
                            exceptionStackIndex = si;
                            break;
                        }
                    }
                    var callingFunctionStack = stackTrace[exceptionStackIndex + 1];
                    var className = callingFunctionStack.getClassName();
                    var methodName = callingFunctionStack.getMethodName();

                    if (className === 'com.android.org.conscrypt.ActiveSession' ||
                        className === 'com.google.android.gms.org.conscrypt.ActiveSession') {
                        throw 'Skipped: non-blocking';
                    }

                    if ((className.indexOf('SSLNullSession') !== -1) && methodName === 'getPeerCertificates') {
                        throw 'Skipped: SSLNullSession getter';
                    }

                    if (!shouldAutoPatchMethod(className, methodName)) {
                        throw 'Skipped: non-SSL business method';
                    }

                    console.log('\x1b[36m[!] SSLPeerUnverifiedException in ' + className + '.' + methodName + '\x1b[0m');
                    var callingMethod = Java.use(className)[methodName];
                    var retTypeName = callingMethod.returnType.type;

                    if (!callingMethod.implementation) {
                        callingMethod.implementation = function () {
                            console.log('\x1b[34m[+] Bypassed unusual pinner ' + className + '.' + methodName + '\x1b[0m');
                            return returner(retTypeName);
                        };
                    }
                } catch (err2) {
                    if (String(err2).indexOf('.overload') !== -1) {
                        overloader(err2, className, methodName, retTypeName);
                    }
                }
                return this.$init(reason);
            };
            console.log('[+] SSLPeerUnverifiedException auto-patcher enabled');
        } catch (err) {}

        // -- Dynamic CertificateException auto-patcher --
        try {
            Java.use('java.security.cert.CertificateException').$init.overload('java.lang.String').implementation = function (reason) {
                try {
                    var stackTrace = Java.use('java.lang.Thread').currentThread().getStackTrace();
                    var exceptionStackIndex = -1;
                    for (var si = 0; si < stackTrace.length; si++) {
                        if (stackTrace[si].getClassName() === "java.security.cert.CertificateException") {
                            exceptionStackIndex = si;
                            break;
                        }
                    }
                    if (exceptionStackIndex !== -1) {
                        var callingFunctionStack = stackTrace[exceptionStackIndex + 1];
                        var className = callingFunctionStack.getClassName();
                        var methodName = callingFunctionStack.getMethodName();

                        if (className.indexOf('conscrypt') !== -1 && methodName === 'checkTrusted') {
                            throw 'Skipped: internal Conscrypt';
                        }

                        if (!shouldAutoPatchMethod(className, methodName)) {
                            throw 'Skipped: non-SSL business method';
                        }

                        console.log('\x1b[36m[!] CertificateException in ' + className + '.' + methodName + ': ' + reason + '\x1b[0m');
                        try {
                            var callingMethod = Java.use(className)[methodName];
                            var retTypeName = callingMethod.returnType.type;

                            if (!callingMethod.implementation) {
                                callingMethod.implementation = function () {
                                    console.log('\x1b[34m[+] Bypassed CertificateException pinner ' + className + '.' + methodName + '\x1b[0m');
                                    return returner(retTypeName);
                                };
                            }
                        } catch (err2) {
                            if (String(err2).indexOf('.overload') !== -1) {
                                overloader(err2, className, methodName, retTypeName);
                            }
                        }
                    }
                } catch (err3) {}
                return this.$init(reason);
            };
            console.log('[+] CertificateException auto-patcher enabled');
        } catch (err) {}

        // -- SSLHandshakeException auto-patcher --
        
        try {
            Java.use('javax.net.ssl.SSLHandshakeException').$init.overload('java.lang.String').implementation = function (reason) {
                try {
                    var stackTrace = Java.use('java.lang.Thread').currentThread().getStackTrace();
                    var exceptionStackIndex = -1;
                    for (var si = 0; si < stackTrace.length; si++) {
                        if (stackTrace[si].getClassName() === "javax.net.ssl.SSLHandshakeException") {
                            exceptionStackIndex = si;
                            break;
                        }
                    }
                    if (exceptionStackIndex !== -1 && exceptionStackIndex + 1 < stackTrace.length) {
                        var callingFunctionStack = stackTrace[exceptionStackIndex + 1];
                        var className = callingFunctionStack.getClassName();
                        var methodName = callingFunctionStack.getMethodName();

                        if (!shouldAutoPatchMethod(className, methodName)) {
                            throw 'Skipped: non-SSL business method';
                        }

                        console.log('\x1b[36m[!] SSLHandshakeException in ' + className + '.' + methodName + ': ' + reason + '\x1b[0m');

                        try {
                            var callingMethod = Java.use(className)[methodName];
                            var retTypeName = callingMethod.returnType.type;
                            if (!callingMethod.implementation) {
                                callingMethod.implementation = function () {
                                    console.log('\x1b[34m[+] Bypassed SSLHandshakeException pinner ' + className + '.' + methodName + '\x1b[0m');
                                    return returner(retTypeName);
                                };
                            }
                        } catch (err2) {
                            if (String(err2).indexOf('.overload') !== -1) {
                                overloader(err2, className, methodName, retTypeName);
                            }
                        }
                    }
                } catch (err3) {}
                return this.$init(reason);
            };
            console.log('[+] SSLHandshakeException auto-patcher enabled');
        } catch (err) {}

        // -- ProviderInstaller bypass --
        console.log("[*] Hooking ProviderInstaller, React Native, Xamarin, Cordova...");
        try {
            Java.use('com.google.android.gms.security.ProviderInstaller').installIfNeeded.implementation = function (context) {
                console.log('[+] ProviderInstaller.installIfNeeded bypassed');
            };
        } catch (err) {}

        try {
            Java.use('com.google.android.gms.security.ProviderInstaller').installIfNeededAsync.implementation = function (context, listener) {
                console.log('[+] ProviderInstaller.installIfNeededAsync bypassed');
            };
        } catch (err) {}

        // -- React Native OkHttpClientProvider --
        try {
            Java.use('com.facebook.react.modules.network.OkHttpClientProvider')
                .getOkHttpClient.implementation = function () {
                    console.log('[+] React Native OkHttpClientProvider intercepted');
                    return this.getOkHttpClient();
                };
        } catch (err) {}

        // -- Xamarin / .NET MAUI --
        try {
            Java.use('mono.android.net.ServerCertificateCustomValidator$TrustManager')
                .checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                .implementation = function (chain, authType) {
                    console.log('[+] Xamarin ServerCertificateCustomValidator bypassed');
                };
        } catch (err) {}

        // -- Cordova Advanced HTTP Plugin --
        try {
            Java.use('com.silkimen.cordovahttp.CordovaHttpPlugin').checkServerTrusted.implementation = function () {
                console.log('[+] Cordova Advanced HTTP bypassed');
            };
        } catch (err) {}

        // -- Cordova ServerTrust --
        try {
            Java.use('com.silkimen.cordovahttp.CordovaServerTrust').init.implementation = function () {
                console.log('[+] Cordova CordovaServerTrust.init bypassed');
            };
        } catch (err) {}

        try {
            Java.use('com.silkimen.cordovahttp.CordovaServerTrust').checkServerTrusted.implementation = function () {
                console.log('[+] Cordova CordovaServerTrust.checkServerTrusted bypassed');
            };
        } catch (err) {}

        try {
            Java.use('com.silkimen.http.TLSConfiguration').getSSLSocketFactory.implementation = function () {
                console.log('[+] Cordova TLSConfiguration.getSSLSocketFactory intercepted');
                return this.getSSLSocketFactory();
            };
        } catch (err) {}

        // -- Conscrypt Platform helper --
        console.log("[*] Hooking Conscrypt Platform helpers...");
        try {
            Java.use('org.conscrypt.Platform')
                .checkServerTrusted.overload(
                    'javax.net.ssl.X509ExtendedTrustManager',
                    '[Ljava.security.cert.X509Certificate;',
                    'java.lang.String',
                    'com.android.org.conscrypt.AbstractConscryptSocket'
                ).implementation = function (tm, chain, authType, socket) {
                    console.log('[+] Conscrypt Platform.checkServerTrusted bypassed');
                };
        } catch (err) {}

        // -- Conscrypt Platform (additional) --
        try {
            Java.use('org.conscrypt.Platform')
                .checkServerTrusted.overload(
                    'javax.net.ssl.X509ExtendedTrustManager',
                    '[Ljava.security.cert.X509Certificate;',
                    'java.lang.String',
                    'org.conscrypt.AbstractConscryptSocket'
                ).implementation = function (tm, chain, authType, socket) {
                    console.log('[+] org.conscrypt Platform.checkServerTrusted (socket) bypassed');
                };
        } catch (err) {}

        try {
            Java.use('org.conscrypt.Platform')
                .checkServerTrusted.overload(
                    'javax.net.ssl.X509ExtendedTrustManager',
                    '[Ljava.security.cert.X509Certificate;',
                    'java.lang.String',
                    'org.conscrypt.ConscryptEngine'
                ).implementation = function (tm, chain, authType, engine) {
                    console.log('[+] org.conscrypt Platform.checkServerTrusted (engine) bypassed');
                };
        } catch (err) {}

        // -- NativeCrypto / NativeSsl hooks --
        
        console.log("[*] Hooking NativeCrypto SSL_do_handshake...");
        var nativeCryptoClasses = [
            'com.android.org.conscrypt.NativeCrypto',
            'org.conscrypt.NativeCrypto',
            'com.google.android.gms.org.conscrypt.NativeCrypto'
        ];
        nativeCryptoClasses.forEach(function (cls) {
            try {
                var nc = Java.use(cls);
                if (nc.SSL_do_handshake) {
                    nc.SSL_do_handshake.overloads.forEach(function (overload) {
                        var orig = overload;
                        orig.implementation = function () {
                            try {
                                return orig.apply(this, arguments);
                            } catch (e) {
                                var errStr = String(e);
                                if (errStr.indexOf('certificate') !== -1 ||
                                    errStr.indexOf('SSL handshake') !== -1 ||
                                    errStr.indexOf('alert') !== -1) {
                                    console.log('[+] ' + cls + '.SSL_do_handshake certificate error suppressed');
                                    // Suppress cert error
                                    return;
                                }
                                throw e;
                            }
                        };
                    });
                    console.log('[+] ' + cls + '.SSL_do_handshake patched');
                }
            } catch (e) {}
        });

        // -- NativeSsl.doHandshake (Android 12+ APEX Conscrypt) --
        
        try {
            var NativeSsl = Java.use('com.android.org.conscrypt.NativeSsl');
            NativeSsl.doHandshake.overloads.forEach(function (overload) {
                overload.implementation = function () {
                    try {
                        return overload.apply(this, arguments);
                    } catch (e) {
                        var msg = String(e);
                        if (msg.indexOf('CERTIFICATE_VERIFY_FAILED') !== -1 ||
                            msg.indexOf('certificate') !== -1 ||
                            msg.indexOf('handshake') !== -1) {
                            console.log('[+] NativeSsl.doHandshake: certificate error suppressed');
                            return; // swallow it
                        }
                        throw e;
                    }
                };
            });
            console.log('[+] com.android.org.conscrypt.NativeSsl.doHandshake hooked');
        } catch (e) {}

        // -- SSLUtils.toSSLHandshakeException --
        // Nullifies the BoringSSL-to-Java exception wrapper
        try {
            var SSLUtils = Java.use('com.android.org.conscrypt.SSLUtils');
            SSLUtils.toSSLHandshakeException.overloads.forEach(function (overload) {
                overload.implementation = function () {
                    // Suppress exception creation
                    return null;
                };
            });
            console.log('[+] SSLUtils.toSSLHandshakeException nullified');
        } catch (e) {}

        // -- SSLNullSession.getPeerCertificates hard bypass --
        
        try {
            var sslNullSessionClasses = [
                'com.android.org.conscrypt.SSLNullSession',
                'org.conscrypt.SSLNullSession',
                'com.google.android.gms.org.conscrypt.SSLNullSession'
            ];
            sslNullSessionClasses.forEach(function (clsName) {
                try {
                    var SN = Java.use(clsName);
                    if (SN.getPeerCertificates) {
                        SN.getPeerCertificates.implementation = function () {
                            console.log('[+] ' + clsName + '.getPeerCertificates bypassed (empty cert array)');
                            return Java.array('java.security.cert.Certificate', []);
                        };
                    }
                    if (SN.getPeerCertificateChain) {
                        SN.getPeerCertificateChain.implementation = function () {
                            return Java.array('javax.security.cert.X509Certificate', []);
                        };
                    }
                } catch (e2) {}
            });
        } catch (e) {}

        // -- Facebook Audience Network pinning --
        try {
            Java.enumerateLoadedClassesSync().forEach(function (className) {
                if (className.indexOf('com.facebook.ads') === 0 ||
                    className.indexOf('com.facebook.ads.redexgen') === 0) {
                    var lower = className.toLowerCase();
                    if (lower.indexOf('trust') !== -1 || lower.indexOf('cert') !== -1 ||
                        lower.indexOf('pin') !== -1 || lower.indexOf('ssl') !== -1 ||
                        lower.indexOf('x509') !== -1) {
                        try {
                            var cls = Java.use(className);
                            ['checkServerTrusted', 'checkClientTrusted', 'verify'].forEach(function (method) {
                                try {
                                    if (cls[method]) {
                                        cls[method].overloads.forEach(function (ov) {
                                            ov.implementation = function () {
                                                console.log('[+] Facebook pinning bypassed: ' + className + '.' + method);
                                                
                                                var retType = ov.returnType ? ov.returnType.className : 'void';
                                                if (retType === 'java.util.List') return Java.use('java.util.ArrayList').$new();
                                                if (retType === 'boolean') return true;
                                            };
                                        });
                                    }
                                } catch (e2) {}
                            });
                        } catch (e) {}
                    }
                }
            });
        } catch (e) {}

        // ================================================================
        // UNIFIED CLASS SCANNER
        // Single-pass enumeration covering: GMS, Firebase, Crashlytics,
        // AppsFlyer, Unity, Facebook Ads, X509TrustManager implementations,
        // X509ExtendedTrustManager, and pinner classes by name.
        // ================================================================
        console.log('[*] Starting unified class scanner (single pass)...');
        try {
            var X509TM = null;
            var X509ETM = null;
            try { X509TM = Java.use('javax.net.ssl.X509TrustManager'); } catch (e) {}
            try { X509ETM = Java.use('javax.net.ssl.X509ExtendedTrustManager'); } catch (e) {}

            var scanStats = { total: 0, pinners: 0, tms: 0, etms: 0, sdk: 0 };
            var pinnerClasses = [];
            var sdkCandidates = [];
            var tmCandidates = [];

            // Phase 1: Collect class names (no Java.use here to avoid deadlocks)
            Java.enumerateLoadedClasses({
                onMatch: function (className) {
                    scanStats.total++;
                    if (scanStats.total % 5000 === 0) {
                        console.log('[*] Scanner phase 1: ' + scanStats.total + ' classes enumerated...');
                    }

                    // Skip system/platform classes
                    if (className.indexOf('dev.asd.test') !== -1) return;
                    if (className.indexOf('java.') === 0 || className.indexOf('javax.') === 0) return;
                    if (className.indexOf('sun.') === 0 || className.indexOf('dalvik.') === 0) return;
                    if (className.indexOf('android.') === 0 && className.indexOf('android.security.net.config') === -1) return;
                    if (className.indexOf('[') === 0) return;

                    var lower = className.toLowerCase();

                    // 1. PINNER NAME DETECTION
                    if (lower.indexOf('pinning') !== -1 || lower.indexOf('certificatepinner') !== -1 ||
                        lower.indexOf('certpin') !== -1 || lower.indexOf('sslpin') !== -1) {
                        pinnerClasses.push(className);
                    }

                    // 2. SDK-SPECIFIC candidates
                    if (className.indexOf('com.google.android.gms') === 0 ||
                        className.indexOf('com.google.firebase') === 0 ||
                        className.indexOf('com.crashlytics') === 0 ||
                        className.indexOf('io.fabric') === 0 ||
                        className.indexOf('com.appsflyer') === 0 ||
                        className.indexOf('com.unity3d') === 0 ||
                        className.indexOf('com.unity.') === 0) {
                        if (lower.indexOf('trust') !== -1 || lower.indexOf('cert') !== -1 ||
                            lower.indexOf('pin') !== -1 || lower.indexOf('ssl') !== -1 ||
                            lower.indexOf('verify') !== -1 || lower.indexOf('tls') !== -1 ||
                            lower.indexOf('x509') !== -1 || lower.indexOf('conscrypt') !== -1) {
                            sdkCandidates.push(className);
                        }
                        return;
                    }

                    // 3. TrustManager candidates (very targeted keywords only)
                    if (X509TM !== null && (lower.indexOf('trustmanager') !== -1 || lower.indexOf('x509') !== -1 ||
                        lower.indexOf('certificat') !== -1 || lower.indexOf('ssltrustm') !== -1)) {
                        tmCandidates.push(className);
                    }
                },
                onComplete: function () {
                    console.log('[*] Scanner phase 1 complete: ' + scanStats.total + ' classes, ' +
                        sdkCandidates.length + ' SDK, ' + tmCandidates.length + ' TM, ' +
                        pinnerClasses.length + ' pinner candidates');

                    // Phase 2: Hook SDK pinning methods
                    sdkCandidates.forEach(function (className) {
                        try {
                            var cls = Java.use(className);
                            var methods = cls.class.getDeclaredMethods();
                            for (var i = 0; i < methods.length; i++) {
                                var m = methods[i];
                                var name = m.getName();
                                if (name === 'checkServerTrusted' || name === 'verify' || name === 'checkPins') {
                                    try {
                                        cls[name].overloads.forEach(function (overload) {
                                            overload.implementation = function () {
                                                console.log('[+] SDK scan: ' + className + '.' + name + ' bypassed');
                                                var retType = overload.returnType.type;
                                                if (retType === 'boolean') return true;
                                                if (retType === 'java.util.List') return Java.use("java.util.ArrayList").$new();
                                                return returner(retType);
                                            };
                                        });
                                        scanStats.sdk++;
                                    } catch (e) {}
                                }
                                if (className.indexOf('com.google.android.gms') === 0 &&
                                    (name === 'a' || name === 'b')) {
                                    try {
                                        var retType = m.getReturnType().getName();
                                        var params = m.getParameterTypes();
                                        if (retType === 'void' && params.length === 2 &&
                                            params[0].getName() === '[Ljava.security.cert.X509Certificate;' &&
                                            params[1].getName() === 'java.lang.String') {
                                            cls[name].overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String')
                                                .implementation = function (chain, authType) {
                                                    console.log('[+] GMS obfuscated pinner bypassed: ' + className + '.' + name);
                                                };
                                            scanStats.sdk++;
                                        }
                                    } catch (e) {}
                                }
                            }
                        } catch (e) {}
                    });

                    // Phase 3: Hook X509TrustManager implementations
                    tmCandidates.forEach(function (className) {
                        try {
                            var cls = Java.use(className);
                            if (cls.class && X509TM.class.isAssignableFrom(cls.class)) {
                                try {
                                    cls.checkServerTrusted.overloads.forEach(function (overload) {
                                        if (!overload.implementation) {
                                            overload.implementation = function () {
                                                console.log('[+] TM: ' + className + '.checkServerTrusted bypassed');
                                                var retType = overload.returnType.type;
                                                if (retType === 'java.util.List') return Java.use("java.util.ArrayList").$new();
                                                return returner(retType);
                                            };
                                            scanStats.tms++;
                                        }
                                    });
                                } catch (e) {}

                                if (X509ETM !== null) {
                                    try {
                                        if (X509ETM.class.isAssignableFrom(cls.class)) {
                                            try {
                                                cls.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.net.Socket')
                                                    .implementation = function (chain, authType, socket) {
                                                        console.log('[+] ETM (Socket): ' + className + ' bypassed');
                                                    };
                                                scanStats.etms++;
                                            } catch (e) {}
                                            try {
                                                cls.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'javax.net.ssl.SSLEngine')
                                                    .implementation = function (chain, authType, engine) {
                                                        console.log('[+] ETM (SSLEngine): ' + className + ' bypassed');
                                                    };
                                                scanStats.etms++;
                                            } catch (e) {}
                                        }
                                    } catch (e) {}
                                }
                            }
                        } catch (e) {}
                    });

                    // Phase 4: Hook classes with pinning-related names
                    if (pinnerClasses.length > 0) {
                        console.log('\x1b[33m[!] Found ' + pinnerClasses.length + ' pinner classes by name:\x1b[0m');
                        pinnerClasses.forEach(function (cn) {
                            try {
                                var cls = Java.use(cn);
                                var methods = cls.class.getDeclaredMethods();
                                for (var i = 0; i < methods.length; i++) {
                                    var mn = methods[i].getName();
                                    if (mn === 'checkServerTrusted' || mn === 'verify' || mn === 'check' || mn === 'validatePins') {
                                        try {
                                            hookAllOverloads(cn, mn);
                                            console.log('\x1b[32m    -> AUTO-HOOKED: ' + cn + '.' + mn + '\x1b[0m');
                                            scanStats.pinners++;
                                        } catch (e) {}
                                    }
                                }
                            } catch (e) {}
                        });
                    }

                    console.log('\x1b[32m[+] UNIFIED SCAN COMPLETE: ' + scanStats.total + ' classes checked\x1b[0m');
                    console.log('\x1b[32m    Pinners: ' + scanStats.pinners + ' | TMs: ' + scanStats.tms +
                        ' | ETMs: ' + scanStats.etms + ' | SDKs: ' + scanStats.sdk + '\x1b[0m');
                }
            });
        } catch (err) {
            console.log('[-] Unified scanner error: ' + err);
        }

        console.log("[+] SSL Pinning bypass completed");

        // -- Flutter / Dart native BoringSSL bypass (@TheDauntless) --
        function bypassFlutterNativo() {
            var m = Process.findModuleByName("libflutter.so");
            if (m === null) {
                setTimeout(bypassFlutterNativo, 500);
                return;
            }

            console.log("[*] Flutter libflutter.so found at: " + m.base);
            var found = false;

            var patternsByArch = {
                "arm64": [
                    "F? 0F 1C F8 F? 5? 01 A9 F? 5? 02 A9 F? ?? 03 A9 ?? ?? ?? ?? 68 1A 40 F9",
                    "F? 43 01 D1 FE 67 01 A9 F8 5F 02 A9 F6 57 03 A9 F4 4F 04 A9 13 00 40 F9 F4 03 00 AA 68 1A 40 F9",
                    "FF 43 01 D1 FE 67 01 A9 ?? ?? 06 94 ?? 7? 06 94 68 1A 40 F9 15 15 41 F9",
                    "FF C3 01 D1 FD 7B 01 A9 6A A1 0B 94 08 0A 80 52 48 00 00 39 1A 50 40 F9",
                    "ff 03 05 d1 fd 7b 0f a9 bc de 05 94 08 0a 80 52 48 00 00 39",
                    "ff 03 05 d1 fd 7b 0f a9 bc de 05 94 08 0a 80 52",
                    "ff c3 03 d1 fc 6f 0a a9 f8 5f 09 a9 f6 57 08 a9",
                    "ff 43 04 d1 fe 67 03 a9 fd fb 02 a9 fd c3 00 91",
                    "FF 83 01 D1 FA 67 01 A9 F8 5F 02 A9 F6 57 03 A9 F4 4F 04 A9 FD 7B 05 A9",
                ],
                "arm": [
                    "2D E9 F? 4? D0 F8 00 80 81 46 D8 F8 18 00 D0 F8",
                    "2d e9 f0 4f a3 b0 82 46 50 20 10 70",
                    "2d e9 f0 4f ad f5 8c 6d 00 24 86 46",
                ],
                "x64": [
                    "55 41 57 41 56 41 55 41 54 53 50 49 89 F? 4? 8B ?? 4? 8B 4? 30 4C 8B ?? ?? 0? 00 00 4D 85 ?? 74 1? 4D 8B",
                    "55 41 57 41 56 41 55 41 54 53 48 83 EC 18 49 89 FF 48 8B 1F 48 8B 43 30 4C 8B A0 28 02 00 00 4D 85 E4 74",
                    "55 41 57 41 56 41 55 41 54 53 48 83 EC 18 49 89 FE 4C 8B 27 49 8B 44 24 30 48 8B 98 D0 01 00 00 48 85 DB",
                ],
                "ia32": [
                    "55 89 E5 53 57 56 83 E4 F0 83 EC 20 E8 00 00 00 00 5B 81 C3 2B 79 66 00 8B 7D 08 8B 17 8B 42 18 8B 80 88 01",
                ],
            };

            var arch = Process.arch;
            var patterns = patternsByArch[arch] || patternsByArch["arm64"];

            // Use r-x memory ranges for more reliable scanning
            var ranges;
            try {
                ranges = Process.enumerateRanges({ protection: 'r-x' }).filter(function (range) {
                    var info = DebugSymbol.fromAddress(range.base);
                    return info.moduleName !== null && info.moduleName.toLowerCase().indexOf("flutter") !== -1;
                });
            } catch (e) {
                ranges = [{ base: m.base, size: m.size }];
            }

            if (ranges.length === 0) {
                ranges = [{ base: m.base, size: m.size }];
            }

            // Strategy 1: Pattern matching
            ranges.forEach(function (range) {
                patterns.forEach(function (pattern) {
                    if (found) return;
                    try {
                        var matches = Memory.scanSync(range.base, range.size, pattern);
                        matches.forEach(function (match) {
                            if (found) return;
                            found = true;
                            console.log("[+] Flutter ssl_verify_peer_cert at: " + match.address);
                            var thumb = (arch === "arm") ? 1 : 0;
                            Interceptor.replace(match.address.add(thumb), new NativeCallback(function (pathPtr, flags) {
                                return 0;
                            }, 'int', ['pointer', 'int']));
                            console.log("[+] Flutter SSL verification patched");
                        });
                    } catch (e) {}
                });
            });

            // Strategy 2: Hook by export name
            if (!found) {
                try {
                    var exports = m.enumerateExports();
                    for (var i = 0; i < exports.length; i++) {
                        var exp = exports[i];
                        if (exp.name.indexOf("ssl_verify_peer_cert") !== -1 ||
                            exp.name.indexOf("ssl_crypto_x509_session_verify_cert_chain") !== -1 ||
                            exp.name.indexOf("verify_cert_chain") !== -1) {
                            console.log("[+] Flutter: replacing export " + exp.name + " at " + exp.address);
                            Interceptor.replace(exp.address, new NativeCallback(function (pathPtr, flags) {
                                return 0;
                            }, 'int', ['pointer', 'int']));
                            found = true;
                            break;
                        }
                    }
                } catch (e) {}
            }

            // Strategy 3: Hook SSL_CTX_set_custom_verify inside libflutter.so
            if (!found) {
                try {
                    var exports = m.enumerateExports();
                    for (var i = 0; i < exports.length; i++) {
                        if (exports[i].name === "SSL_CTX_set_custom_verify") {
                            console.log("[+] Flutter: hooking SSL_CTX_set_custom_verify at " + exports[i].address);
                            Interceptor.attach(exports[i].address, {
                                onEnter: function (args) {
                                    args[1] = ptr(0x0);
                                    args[2] = ptr(0x0);
                                }
                            });
                            found = true;
                            break;
                        }
                    }
                } catch (e) {}
            }

            if (!found) {
                console.log("[-] Flutter SSL verify function not found in this version");
            }
        }

        try {
            bypassFlutterNativo();
        } catch (e) {
            console.log("[-] Error initializing Flutter bypass: " + e);
        }
    });
}, 0);

// ========================================================================
// NATIVE SSL BYPASS
// ========================================================================
function hookNativeSSLExports(module, moduleName) {
    var hookCount = 0;

    var hooksToApply = [
        { name: "SSL_CTX_set_custom_verify", handler: function (args) { args[1] = ptr(0x0); args[2] = ptr(0x0); } },
        { name: "SSL_set_custom_verify", handler: function (args) { args[1] = ptr(0x0); args[2] = ptr(0x0); } },
        { name: "SSL_CTX_set_verify", handler: function (args) { args[1] = ptr(0x0); if (args.length > 2) args[2] = ptr(0x0); } },
        { name: "SSL_set_verify", handler: function (args) { args[1] = ptr(0x0); } },
        // SSL_CTX_set_cert_verify_callback - additional BoringSSL callback
        { name: "SSL_CTX_set_cert_verify_callback", handler: function (args) { args[1] = ptr(0x0); args[2] = ptr(0x0); } },
    ];

    var retvalHooks = [
        { name: "X509_verify_cert", retval: 1 },
        { name: "SSL_get_verify_result", retval: 0 },
        // Additional verification functions
        { name: "X509_verify", retval: 1 },
        { name: "i2d_SSL_SESSION", retval: 1 },
    ];

    hooksToApply.forEach(function (hook) {
        try {
            Interceptor.attach(module.getExportByName(hook.name), {
                onEnter: function (args) {
                    hook.handler(args);
                }
            });
            hookCount++;
        } catch (e) {}
    });

    retvalHooks.forEach(function (hook) {
        try {
            Interceptor.attach(module.getExportByName(hook.name), {
                onLeave: function (retval) { retval.replace(hook.retval); }
            });
            hookCount++;
        } catch (e) {}
    });

    // Hook ssl_verify_peer_cert if exported
    try {
        var ssl_verify_peer_cert = module.getExportByName("ssl_verify_peer_cert");
        if (ssl_verify_peer_cert) {
            Interceptor.attach(ssl_verify_peer_cert, {
                onLeave: function (retval) { retval.replace(0); }
            });
            hookCount++;
        }
    } catch (e) {}

    // Hook ssl_send_alert to suppress certificate_unknown alerts
    try {
        var ssl_send_alert = module.getExportByName("ssl_send_alert");
        if (ssl_send_alert) {
            Interceptor.attach(ssl_send_alert, {
                onEnter: function (args) {
                    
                    // 48 = certificate_unknown, 42 = bad_certificate, 43 = unsupported_certificate
                    // 44 = certificate_revoked, 45 = certificate_expired, 46 = certificate_unknown
                    try {
                        var alertDesc = args[2].toInt32();
                        if (alertDesc === 48 || alertDesc === 42 || alertDesc === 43 ||
                            alertDesc === 44 || alertDesc === 45 || alertDesc === 46) {
                            console.log("[+] " + moduleName + ": suppressed ssl_send_alert (desc=" + alertDesc + ")");
                            args[2] = ptr(0x0); 
                        }
                    } catch (e) {}
                }
            });
            hookCount++;
        }
    } catch (e) {}

    // Pattern scan for ssl_verify_peer_cert if not exported
    try {
        var foundVerify = false;
        var verifyPatterns = [
            "08 40 b9 08 01 00 35",
            "55 48 89 e5 41 57 41 56 41 55",
        ];
        verifyPatterns.forEach(function (pattern) {
            if (foundVerify) return;
            try {
                Memory.scan(module.base, module.size, pattern, {
                    onMatch: function (address, size) {
                        if (foundVerify) return;
                        foundVerify = true;
                        console.log("[+] " + moduleName + ": ssl_verify_peer_cert candidate at: " + address);
                        Interceptor.attach(address, {
                            onLeave: function (retval) { retval.replace(0); }
                        });
                        hookCount++;
                    },
                    onComplete: function () {}
                });
            } catch (e) {}
        });
    } catch (e) {}

    console.log("[+] " + moduleName + ": " + hookCount + " hooks installed");
    return hookCount;
}

function hook_libssl() {
    try {
        var module = Process.getModuleByName("libssl.so");
        console.log("[+] libssl base:", module.base);
        hookNativeSSLExports(module, "libssl");
    } catch (e) {
        console.log("[-] Error hooking libssl:", e);
    }
}
function hook_libboringssl() {
    try {
        var module = Process.getModuleByName("libboringssl.so");
        console.log("[+] libboringssl base:", module.base);
        hookNativeSSLExports(module, "libboringssl");
    } catch (e) {}
}

function hook_libsscronet() {
    try {
        var module = Process.getModuleByName("libsscronet.so");
        console.log("[+] libsscronet.so (TikTok) base:", module.base);
        hookNativeSSLExports(module, "libsscronet");
    } catch (e) {}
}

function hook_libliger() {
    var libNames = ["libliger.so", "libliger-native.so"];
    libNames.forEach(function (libName) {
        try {
            var module = Process.getModuleByName(libName);
            console.log("[+] " + libName + " (Instagram/Meta) base:", module.base);

            hookNativeSSLExports(module, libName);

            var exports = module.enumerateExports();
            for (var i = 0; i < exports.length; i++) {
                if (exports[i].name.indexOf("verifyWithMetrics") !== -1 ||
                    exports[i].name.indexOf("SSLVerification") !== -1) {
                    console.log("[+] " + libName + ": hooking " + exports[i].name);
                    Interceptor.attach(exports[i].address, {
                        onLeave: function (retval) { retval.replace(1); }
                    });
                }
            }

            console.log("[+] " + libName + " hooks installed (Instagram/Meta)");
        } catch (e) {}
    });
}

function hook_libcoldstart() {
    try {
        var module = Process.getModuleByName("libcoldstart.so");
        console.log("[+] libcoldstart.so (Facebook) base:", module.base);

        hookNativeSSLExports(module, "libcoldstart");

        var exports = module.enumerateExports();
        for (var i = 0; i < exports.length; i++) {
            if (exports[i].name.indexOf("verifyWithMetrics") !== -1 ||
                exports[i].name.indexOf("SSLVerification") !== -1) {
                console.log("[+] libcoldstart: hooking " + exports[i].name);
                Interceptor.attach(exports[i].address, {
                    onLeave: function (retval) { retval.replace(1); }
                });
            }
        }

        console.log("[+] libcoldstart hooks installed (Facebook)");
    } catch (e) {}
}

// -- libcronet.so hooks (Google services Cronet networking) --
function hook_libcronet() {
    try {
        var module = Process.getModuleByName("libcronet.so");
        console.log("[+] libcronet.so (Google Cronet) base:", module.base);
        hookNativeSSLExports(module, "libcronet");

        var exports = module.enumerateExports();
        for (var i = 0; i < exports.length; i++) {
            if (exports[i].name.indexOf("CertVerify") !== -1 ||
                exports[i].name.indexOf("cert_verify") !== -1 ||
                exports[i].name.indexOf("pinning") !== -1) {
                console.log("[+] libcronet: hooking " + exports[i].name);
                Interceptor.attach(exports[i].address, {
                    onLeave: function (retval) { retval.replace(0); }
                });
            }
        }

        console.log("[+] libcronet hooks installed (Google Cronet)");
    } catch (e) {}
}

// -- libconscrypt_jni.so hooks (Conscrypt JNI layer) --
function hook_libconscrypt_jni() {
    try {
        var module = Process.getModuleByName("libconscrypt_jni.so");
        console.log("[+] libconscrypt_jni.so base:", module.base);
        hookNativeSSLExports(module, "libconscrypt_jni");
    } catch (e) {}
}

// -- libjavacrypto.so (APEX Conscrypt BoringSSL, Android 12+) --
function hook_libjavacrypto() {
    var candidates = [
        'libjavacrypto.so'
    ];
    candidates.forEach(function (libName) {
        try {
            var module = Process.getModuleByName(libName);
            console.log('[+] ' + libName + ' (APEX Conscrypt) base:', module.base);
            hookNativeSSLExports(module, libName);

            try {
                var setCustomVerify = module.findExportByName('SSL_CTX_set_custom_verify');
                if (setCustomVerify) {
                    Interceptor.attach(setCustomVerify, {
                        onEnter: function (args) {
                            
                            args[1] = ptr(0); // mode = SSL_VERIFY_NONE
                            args[2] = ptr(0); // callback = NULL
                            console.log('[+] ' + libName + ': SSL_CTX_set_custom_verify nulled');
                        }
                    });
                }
            } catch (e) {}
        } catch (e) {}
    });
}

// -- libgmscore.so hooks (Google Play Services core) --
function hook_libgmscore() {
    try {
        var module = Process.getModuleByName("libgmscore.so");
        console.log("[+] libgmscore.so base:", module.base);
        hookNativeSSLExports(module, "libgmscore");
    } catch (e) {}
}

// -- libchromium_net.so hooks (Chromium networking) --
function hook_libchromium_net() {
    try {
        var module = Process.getModuleByName("libchromium_net.so");
        console.log("[+] libchromium_net.so base:", module.base);
        hookNativeSSLExports(module, "libchromium_net");
    } catch (e) {}
}

// -- android_dlopen_ext watcher (enhanced) --
try {
    var android_dlopen_ext = Process.getModuleByName("libdl.so").getExportByName("android_dlopen_ext");
    Interceptor.attach(android_dlopen_ext, {
        onEnter: function (args) {
            try {
                this.libname = args[0].readCString();
            } catch (e) {
                this.libname = null;
            }
        },
        onLeave: function (retval) {
            if (!this.libname) return;
            var name = this.libname;
            if (name.indexOf("libssl.so") !== -1) { console.log("[+] libssl loaded"); hook_libssl(); }
            if (name.indexOf("libboringssl.so") !== -1) { console.log("[+] libboringssl loaded"); hook_libboringssl(); }
            if (name.indexOf("libsscronet.so") !== -1) { console.log("[+] libsscronet loaded"); hook_libsscronet(); }
            if (name.indexOf("libliger.so") !== -1 || name.indexOf("libliger-native.so") !== -1) { console.log("[+] libliger loaded"); hook_libliger(); }
            if (name.indexOf("libcoldstart.so") !== -1) { console.log("[+] libcoldstart loaded"); hook_libcoldstart(); }
            // Additional library watchers
            if (name.indexOf("libcronet.so") !== -1) { console.log("[+] libcronet loaded"); hook_libcronet(); }
            if (name.indexOf("libconscrypt_jni.so") !== -1) { console.log("[+] libconscrypt_jni loaded"); hook_libconscrypt_jni(); }
            if (name.indexOf("libjavacrypto.so") !== -1) { console.log("[+] libjavacrypto loaded"); hook_libjavacrypto(); }
            if (name.indexOf("libgmscore.so") !== -1) { console.log("[+] libgmscore loaded"); hook_libgmscore(); }
            if (name.indexOf("libchromium_net.so") !== -1) { console.log("[+] libchromium_net loaded"); hook_libchromium_net(); }
        }
    });
} catch (e) {
    console.log("[-] Failed to hook android_dlopen_ext:", e);
}

// -- Also hook dlopen for older Android versions --
try {
    var dlopenAddr = Module.findExportByName("libdl.so", "dlopen");
    if (dlopenAddr) {
        Interceptor.attach(dlopenAddr, {
            onEnter: function (args) {
                try {
                    this.libname = args[0].readCString();
                } catch (e) {
                    this.libname = null;
                }
            },
            onLeave: function (retval) {
                if (!this.libname) return;
                var name = this.libname;
                if (name.indexOf("libssl.so") !== -1) hook_libssl();
                if (name.indexOf("libboringssl.so") !== -1) hook_libboringssl();
                if (name.indexOf("libcronet.so") !== -1) hook_libcronet();
                if (name.indexOf("libconscrypt_jni.so") !== -1) hook_libconscrypt_jni();
                if (name.indexOf("libjavacrypto.so") !== -1) hook_libjavacrypto();
            }
        });
    }
} catch (e) {}

// -- Delayed check for already-loaded native libraries --
setTimeout(function () {
    try { Process.getModuleByName("libssl.so"); hook_libssl(); } catch (e) {}
    try { Process.getModuleByName("libboringssl.so"); hook_libboringssl(); } catch (e) {}
    try { Process.getModuleByName("libsscronet.so"); hook_libsscronet(); } catch (e) {}
    try { Process.getModuleByName("libliger.so"); hook_libliger(); } catch (e) {}
    try { Process.getModuleByName("libcoldstart.so"); hook_libcoldstart(); } catch (e) {}
    // Check for additional libraries
    try { Process.getModuleByName("libcronet.so"); hook_libcronet(); } catch (e) {}
    try { Process.getModuleByName("libconscrypt_jni.so"); hook_libconscrypt_jni(); } catch (e) {}
    try { Process.getModuleByName("libjavacrypto.so"); hook_libjavacrypto(); } catch (e) {}
    try { Process.getModuleByName("libgmscore.so"); hook_libgmscore(); } catch (e) {}
    try { Process.getModuleByName("libchromium_net.so"); hook_libchromium_net(); } catch (e) {}
}, 1000);

// ========================================================================
// BYPASS FRIDA / XPOSED DETECTION
// ========================================================================

// Hook fgets to sanitize "frida" and "xposed" strings from /proc reads
// Using Interceptor.attach (compatible with Frida 17.x on ARM64)
try {
    var fgetsPtr = Module.findExportByName("libc.so", "fgets");
    if (fgetsPtr) {
        // Create NativeFunction wrapper for original fgets BEFORE replacing
        var originalFgets = new NativeFunction(fgetsPtr, 'pointer', ['pointer', 'int', 'pointer']);
        Interceptor.replace(fgetsPtr, new NativeCallback(function (buffer, size, fp) {
            var ret = originalFgets(buffer, size, fp);
            if (!ret.isNull()) {
                try {
                    var content = buffer.readUtf8String();
                    if (content && content.indexOf("frida") !== -1) {
                        buffer.writeUtf8String("ByeByeFrida:\t0\n");
                    } else if (content && content.indexOf("xposed") !== -1) {
                        buffer.writeUtf8String("ByeByeXposed:\t0\n");
                    }
                } catch (e) {}
            }
            return ret;
        }, 'pointer', ['pointer', 'int', 'pointer']));
        console.log("[+] Anti-Frida fgets hook OK (replace mode)");
    }
} catch (e) {
    console.log("[-] Anti-Frida fgets hook failed: " + e);
}

// Hook strstr to hide Frida-related thread names
try {
    var strstrPtr = Module.findExportByName("libc.so", "strstr");
    if (strstrPtr) {
        Interceptor.attach(strstrPtr, {
            onEnter: function (args) {
                try {
                    this.needle = args[1].readUtf8String();
                } catch (e) {
                    this.needle = null;
                }
            },
            onLeave: function (retval) {
                if (this.needle !== null && !retval.isNull()) {
                    if (this.needle === "frida" || this.needle === "gmain" ||
                        this.needle === "gum-js-loop" || this.needle === "linjector") {
                        console.log("[+] Hiding '" + this.needle + "' from strstr check");
                        retval.replace(ptr(0x0));
                    }
                }
            }
        });
        console.log("[+] Anti-Frida strstr hook installed");
    }
} catch (e) {}

// Hook pthread_create to hide Frida agent threads
try {
    var pthreadCreateAddr = Module.findExportByName("libc.so", "pthread_create");
    if (pthreadCreateAddr) {
        Interceptor.attach(pthreadCreateAddr, {
            onEnter: function (args) {
                
            }
        });
    }
} catch (e) {}

// Hook /proc/self/maps read to hide Frida libraries
try {
    var openProcMaps = Module.findExportByName("libc.so", "openat");
    if (openProcMaps) {
        Interceptor.attach(openProcMaps, {
            onEnter: function (args) {
                try {
                    var path = args[1].readUtf8String();
                    if (path && (path.indexOf("/proc/self/maps") !== -1 || path.indexOf("/proc/self/status") !== -1)) {
                        this.isProcMaps = true;
                    }
                } catch (e) {}
            },
            onLeave: function (retval) {
                if (this.isProcMaps) {
                    
                    this.isProcMaps = false;
                }
            }
        });
    }
} catch (e) {}

console.log("");
console.log("======================================================");
console.log("[+] FRIDA UNIFIED BYPASS LOADED SUCCESSFULLY!");
console.log("======================================================");
console.log("");