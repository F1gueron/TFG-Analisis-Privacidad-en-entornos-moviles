/**
 * ========================================================================
 * FRIDA UNIFIED BYPASS SCRIPT - ULTIMATE EDITION 
 * ========================================================================
 * Integrating:
 * - fdciabdul/frida-multiple-bypass
 * - akabe1/frida-multiple-unpinning
 * - pcipolloni/universal-android-ssl-pinning-bypass
 * ========================================================================
 * Added Features:
 * + Custom TrustManager using Proxy CA
 * + Extended hooks for OkHttp4 / gRPC / Play Services
 * + Generic Network Security Config bypass
 * + Generic SSLSocketFactory / HostnameVerifier hooks
 * ========================================================================
 * This script was developed by @Figueron for his Bachelor's Thesis.
 * If you have any questions or want to see more checks implemented, 
 * you can reach me at:
 * - jfiguerasmarquez@gmail.com
 * - https://github.com/F1gueron
 * Feel free to fork it and add your own improvements!
 * ========================================================================
 * TODO:
 * - Bypass:
 *  [] *.googleapis.com
 *  [] app-measurement.com
 *  [] firebase-settings.crashlytics.com
 *  [] *.unity3d.com
 */

// ========================================================================
// GLOBAL CONFIGURATION
// ========================================================================

const commonPaths = [
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

const ROOTmanagementApp = [
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

const RootBinaries = ["su", "busybox", "supersu", "Superuser.apk", "KingoUser.apk", "SuperSu.apk", "magisk"];

const RootProperties = {
    "ro.build.selinux": "1", "ro.debuggable": "0",
    "service.adb.root": "0", "ro.secure": "1",
};

var RootPropertiesKeys = [];
for (var k in RootProperties) RootPropertiesKeys.push(k);

const caFile = "/data/local/tmp/cacert.crt";

console.log("");
console.log("======================================================");
console.log("[*] FRIDA UNIFIED BYPASS by @Figueron - INITIALIZING...");
console.log("======================================================");
console.log(`Using ${caFile} as file for custom CA injection`);
console.log("To change this, modify caFile in this script")
console.log("======================================================");

// ========================================================================
// BYPASS EMULATOR DETECTION
// ========================================================================

Java.perform(function() {
    console.log("[*] Bypassing Emulator Detection...");
    
    // Fake build properties (Samsung Galaxy S7 Edge)
    try {
        Java.use("android.os.Build").PRODUCT.value = "gracerltexx";
        Java.use("android.os.Build").MANUFACTURER.value = "samsung";
        Java.use("android.os.Build").BRAND.value = "samsung";
        Java.use("android.os.Build").DEVICE.value = "gracerlte";
        Java.use("android.os.Build").MODEL.value = "SM-N935F";
        Java.use("android.os.Build").HARDWARE.value = "samsungexynos8890";
        Java.use("android.os.Build").FINGERPRINT.value = "samsung/gracerltexx/gracerlte:8.0.0/R16NW/N935FXXS4BRK2:user/release-keys";
        console.log("[+] Build properties modified");
    } catch (err) {}

    // Hide emulator files
    try {
        Java.use("java.io.File").exists.implementation = function() {
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
        Java.use("android.app.ApplicationPackageManager").getPackageInfo.overload("java.lang.String", "int").implementation = function(name, flag) {
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
            onLeave: function(retval) {
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

setTimeout(function() {
    console.log("[*] Bypassing Root Detection...");

    // Native hooks
    var fopenAddr = Process.getModuleByName('libc.so').findExportByName('fopen');
    if (fopenAddr) {
        try {
            Interceptor.attach(fopenAddr, {
                onEnter: function(args) { 
                    this.inputPath = args[0].readCString(); 
                },
                onLeave: function(retval) {
                    if (retval.toInt32() != 0) {
                        if (commonPaths.indexOf(this.inputPath) >= 0) {
                            console.log("[+] fopen blocked: " + this.inputPath);
                            retval.replace(ptr(0x0));
                        }
                        var path = this.inputPath.split("/").pop();
                        if (RootBinaries.indexOf(path) > -1) {
                            console.log("[+] fopen blocked binary: " + path);
                            retval.replace(ptr(0x0));
                        }
                    }
                },
            });
            console.log("[+] fopen hooked");
        } catch(e) { 
            console.log("[-] fopen hook failed: " + e); 
        }
    }

    // Hook access() to prevent detection of su binaries and known root paths
    var accessAddr = Process.getModuleByName('libc.so').findExportByName('access');
    if (accessAddr) {
        try {
            Interceptor.attach(accessAddr, {
                onEnter: function(args) { 
                    this.inputPath = args[0].readUtf8String(); 
                },
                onLeave: function(retval) {
                    if (retval.toInt32() == 0 && commonPaths.indexOf(this.inputPath) >= 0) {
                        console.log("[+] access blocked: " + this.inputPath);
                        retval.replace(ptr(-1));
                    }
                },
            });
            console.log("[+] access hooked");
        } catch(e) { 
            console.log("[-] access hook failed: " + e); 
        }
    }

    // Hook __system_property_get to spoof specific build properties (fingerprint, tags)
    var sysPropAddr = Process.getModuleByName('libc.so').findExportByName('__system_property_get');
    if (sysPropAddr) {
        try {
            Interceptor.attach(sysPropAddr, {
                onEnter: function(args) { 
                    this.key = args[0].readCString(); 
                    this.ret = args[1]; 
                },
                onLeave: function(ret) {
                    if (this.key == "ro.build.fingerprint") {
                        var tmp = "google/crosshatch/crosshatch:10/QQ3A.200805.001/6578210:user/release-keys";
                        var p = Memory.allocUtf8String(tmp);
                        Memory.copy(this.ret, p, tmp.length + 1);
                    } else if (this.key == "ro.build.tags") {
                        var tmp = "release-keys";
                        var p = Memory.allocUtf8String(tmp);
                        Memory.copy(this.ret, p, tmp.length + 1);
                    }
                },
            });
            console.log("[+] __system_property_get hooked");
        } catch(e) { 
            console.log("[-] __system_property_get hook failed: " + e); 
        }
    }

    // system() is commonly used to execute root checks, so we hook it to block dangerous commands
    var systemAddr = Process.getModuleByName('libc.so').findExportByName('system');
    if (systemAddr) {
        try {
            Interceptor.attach(systemAddr, {
                onEnter: function(args) {
                    var cmd = Memory.readCString(args[0]);
                    if (cmd.indexOf("su") != -1 || cmd.indexOf("getprop") != -1 || cmd.indexOf("mount") != -1 || cmd.indexOf("id") != -1) {
                        console.log("[+] system() blocked: " + cmd);
                        Memory.writeUtf8String(args[0], "grep");
                    }
                },
            });
            console.log("[+] system hooked");
        } catch(e) {
            console.log("[-] system hook failed: " + e);
        }
    }

    // Java hooks
    Java.perform(function() {
        // Hide su binaries by hooking java.io.UnixFileSystem.checkAccess
        try {
            var UnixFileSystem = Java.use("java.io.UnixFileSystem");
            UnixFileSystem.checkAccess.implementation = function(file, access) {
                const filename = file.getAbsolutePath();
                if (filename.indexOf("magisk") >= 0 || commonPaths.indexOf(filename) >= 0) {
                    console.log("[+] Hiding file: " + filename);
                    return false;
                }
                return this.checkAccess(file, access);
            };
        } catch(e) {}

        // Spoof Build.TAGS and Build.FINGERPRINT to hide test-keys and custom builds
        try {
            var Build = Java.use("android.os.Build");
            var TAGS = Build.class.getDeclaredField("TAGS");
            TAGS.setAccessible(true); 
            TAGS.set(null, "release-keys");
            
            var FINGERPRINT = Build.class.getDeclaredField("FINGERPRINT");
            FINGERPRINT.setAccessible(true);
            FINGERPRINT.set(null, "google/crosshatch/crosshatch:10/QQ3A.200805.001/6578210:user/release-keys");
        } catch(e) {}

        // Hide root management apps by hooking ApplicationPackageManager.getPackageInfo
        try {
            Java.use("android.app.ApplicationPackageManager").getPackageInfo.overload("java.lang.String", "int").implementation = function(str, i) {
                if (ROOTmanagementApp.indexOf(str) >= 0) {
                    console.log("[+] Hiding package: " + str);
                    str = "fake.package.name";
                }
                return this.getPackageInfo(str, i);
            };
        } catch(e) {}

        // Hide su binaries by hooking java.lang.ProcessImpl.start
        try {
            var StringClass = Java.use("java.lang.String");
            Java.use("java.lang.ProcessImpl").start.implementation = function(cmdarray, env, dir, redirects, redirectErrorStream) {
                if (cmdarray[0] == "mount" || (cmdarray[0] == "getprop" && ["ro.secure", "ro.debuggable"].indexOf(cmdarray[1]) >= 0) || 
                    (cmdarray[0].indexOf("which") >= 0 && cmdarray[1] == "su")) {
                    console.log("[+] Blocking command: " + cmdarray[0]);
                    arguments[0] = Java.array("java.lang.String", [StringClass.$new("")]);
                }
                return this.start.apply(this, arguments);
            };
        } catch(e) {}

        // Hide su binaries by hooking java.io.File.exists
        try {
            var NativeFile = Java.use("java.io.File");
            NativeFile.exists.implementation = function() {
                var name = NativeFile.getName.call(this);
                if (RootBinaries.indexOf(name) > -1) {
                    console.log("[+] Hiding binary: " + name);
                    return false;
                }
                return this.exists.call(this);
            };
        } catch(e) {}

        // Block root checks by hooking java.lang.Runtime.exec and filtering dangerous commands
        try {
            var Runtime = Java.use("java.lang.Runtime");
            var exec1 = Runtime.exec.overload("java.lang.String");
            var exec2 = Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;");
            var exec3 = Runtime.exec.overload("[Ljava.lang.String;", "[Ljava.lang.String;");
            var exec4 = Runtime.exec.overload("[Ljava.lang.String;", "[Ljava.lang.String;", "java.io.File");
            var exec5 = Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;", "java.io.File");

            var execHandler = function(args, isArray) {
                var cmd = args[0];
                var cmdStr = isArray ? cmd.join(' ') : cmd;
                if (cmdStr.indexOf("su") != -1 || cmdStr.indexOf("getprop") != -1 || cmdStr.indexOf("mount") != -1) {
                    console.log("[+] Blocking exec: " + cmdStr);
                    return exec1.call(this, "grep");
                }
                return null;
            };

            exec1.implementation = function(cmd) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec1.call(this, cmd);
            };
            exec2.implementation = function(cmd, env) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec2.call(this, cmd, env);
            };
            exec3.implementation = function(cmd, env) {
                var result = execHandler.call(this, arguments, true);
                return result ? result : exec3.call(this, cmd, env);
            };
            exec4.implementation = function(cmd, env, file) {
                var result = execHandler.call(this, arguments, true);
                return result ? result : exec4.call(this, cmd, env, file);
            };
            exec5.implementation = function(cmd, env, file) {
                var result = execHandler.call(this, arguments, false);
                return result ? result : exec5.call(this, cmd, env, file);
            };
        } catch(e) {}

        // Hide test-keys in Build.TAGS which is commonly used to detect rooted devices
        try {
            Java.use("java.lang.String").contains.implementation = function(name) {
                if (name == "test-keys") {
                    console.log("[+] Hiding test-keys");
                    return false;
                }
                return this.contains.call(this, name);
            };
        } catch(e) {}

        // Spoof root-related properties by hooking android.os.SystemProperties.get
        try {
            Java.use("android.os.SystemProperties").get.overload("java.lang.String").implementation = function(name) {
                if (RootPropertiesKeys.indexOf(name) != -1) {
                    console.log("[+] Spoofing property: " + name);
                    return RootProperties[name];
                }
                return this.get.call(this, name);
            };
        } catch(e) {}

        console.log("[+] Root detection bypasses initialized");
    });
}, 0);

// ========================================================================
// SSL PINNING 
// ========================================================================

setTimeout(function() {
    Java.perform(function() {
        console.log("[*] Bypassing SSL Pinning...");
        var errDict = {};

        // Inject custom permissive X509TrustManager via SSLContext.init
        try {
            var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
            var SSLContext = Java.use('javax.net.ssl.SSLContext');
            var TrustManager = Java.registerClass({
                name: 'dev.asd.test.TrustManager',
                implements: [X509TrustManager],
                methods: {
                    checkClientTrusted: function(chain, authType) {},
                    checkServerTrusted: function(chain, authType) {},
                    getAcceptedIssuers: function() { return []; }
                }
            });
            SSLContext.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom').implementation = function(km, tm, sr) {
                console.log('[+] SSLContext (TrustManager) bypassed');
                this.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom').call(this, km, [TrustManager.$new()], sr);
            };
        } catch (err) {}

        // TrustManager using burpsuiteCA
        try {
            var FileInputStream = Java.use("java.io.FileInputStream");
            var BufferedInputStream = Java.use("java.io.BufferedInputStream");
            var CertificateFactory = Java.use("java.security.cert.CertificateFactory");
            var KeyStore = Java.use("java.security.KeyStore");
            var TrustManagerFactory = Java.use("javax.net.ssl.TrustManagerFactory");
            var SSLContext2 = Java.use("javax.net.ssl.SSLContext");

            var cf = CertificateFactory.getInstance("X.509");
            var fis = FileInputStream.$new(caFile); 
            var bis = BufferedInputStream.$new(fis);
            var ca = cf.generateCertificate(bis);

            var ks = KeyStore.getInstance(KeyStore.getDefaultType());
            ks.load(null, null);
            ks.setCertificateEntry("mitm", ca);

            var tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(ks);

            SSLContext2.init.overload(
                "[Ljavax.net.ssl.KeyManager;",
                "[Ljavax.net.ssl.TrustManager;",
                "java.security.SecureRandom"
            ).implementation = function (km, tm, sr) {
                console.log("[+] SSLContext forced to mitmproxy CA");
                this.init(km, tmf.getTrustManagers(), sr);
            };
        } catch (e) {
            console.log("[-] Custom TrustManager failed: " + e);
        }

        // HttpsURLConnection
        try {
            var HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
            HttpsURLConnection.setDefaultHostnameVerifier.implementation = function(hv) { console.log("[+] HttpsURLConnection bypassed"); };
            HttpsURLConnection.setSSLSocketFactory.implementation = function(sf) { console.log("[+] HttpsURLConnection SSLFactory bypassed"); };
            HttpsURLConnection.setHostnameVerifier.implementation = function(hv) { console.log("[+] HttpsURLConnection HostnameVerifier bypassed"); };
        } catch (err) {}

        // OkHTTP3 CertificatePinner overload hooks
        ['java.util.List', 'java.security.cert.Certificate', '[Ljava.security.cert.Certificate;'].forEach(function(type, idx) {
            try {
                Java.use('okhttp3.CertificatePinner').check.overload('java.lang.String', type).implementation = function(a, b) {
                    console.log('[+] OkHTTP3 {' + (idx+1) + '} bypassed: ' + a);
                };
            } catch (err) { errDict[err] = ['okhttp3.CertificatePinner', 'check']; }
        });
        
        try {
            Java.use('okhttp3.CertificatePinner').check$okhttp.overload('java.lang.String', 'kotlin.jvm.functions.Function0').implementation = function(a, b) {
                console.log('[+] OkHTTP3 {4} bypassed: ' + a);
            };
        } catch (err) {}

        // OkHttp3 
        try {
            var RealCall = Java.use("okhttp3.internal.connection.RealCall");
            RealCall.getResponseWithInterceptorChain.implementation = function () {
                console.log("[+] OkHttp RealCall.getResponseWithInterceptorChain");
                return this.getResponseWithInterceptorChain();
            };
        } catch (e) {
            console.log("[-] OkHttp RealCall not found: " + e);
        }

        // gRPC OkHttpChannelBuilder
        try {
            var OkHttpChannelBuilder = Java.use("io.grpc.okhttp.OkHttpChannelBuilder");
            OkHttpChannelBuilder.sslSocketFactory.overload(
                "javax.net.ssl.SSLSocketFactory"
            ).implementation = function(sf) {
                console.log("[+] gRPC OkHttpChannelBuilder sslSocketFactory bypass");
                return this.sslSocketFactory(sf);
            };
        } catch (e) {}

        // Hook potential internal GoogleApiClient pinning logic (Play Services)
        try {
            var GoogleApiClient = Java.use("com.google.android.gms.common.internal.zal");
            GoogleApiClient.zaa.implementation = function() {
                console.log("[+] GoogleApiClient.z a a called (possible pinning)");
                return this.zaa();
            };
        } catch (e) {}

        // Trustkit HostnameVerifier
        try {
            var tk1 = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
            tk1.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function(a, b) { console.log('[+] Trustkit {1}: ' + a); return true; };
            tk1.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function(a, b) { console.log('[+] Trustkit {2}: ' + a); return true; };
        } catch (err) {}
        
        // Trustkit PinningTrustManager
        try {
            Java.use('com.datatheorem.android.trustkit.pinning.PinningTrustManager').checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String').implementation = function() {
                console.log('[+] Trustkit PinningTrustManager bypassed');
            };
        } catch (err) {}

        // TrustManagerImpl (Android > 7)
        try {
            var array_list = Java.use("java.util.ArrayList");
            var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
            TrustManagerImpl.checkTrustedRecursive.implementation = function() {
                console.log('[+] TrustManagerImpl checkTrustedRecursive bypassed');
                return array_list.$new();
            };
            TrustManagerImpl.verifyChain.implementation = function(untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
                console.log('[+] TrustManagerImpl verifyChain bypassed: ' + host);
                return untrustedChain;
            };
        } catch (err) {}

        // Appcelerator
        try {
            Java.use('appcelerator.https.PinningTrustManager').checkServerTrusted.implementation = function() {
                console.log('[+] Appcelerator bypassed');
            };
        } catch (err) {}

        // OpenSSLSocketImpl Conscrypt
        try {
            Java.use('com.android.org.conscrypt.OpenSSLSocketImpl').verifyCertificateChain.implementation = function() {
                console.log('[+] OpenSSLSocketImpl Conscrypt bypassed');
            };
        } catch (err) {}

        // OpenSSLEngineSocketImpl
        try {
            Java.use('com.android.org.conscrypt.OpenSSLEngineSocketImpl').verifyCertificateChain.overload('[Ljava.lang.Long;', 'java.lang.String').implementation = function(a, b) {
                console.log('[+] OpenSSLEngineSocketImpl bypassed: ' + b);
            };
        } catch (err) {}

        // Apache Harmony
        try {
            Java.use('org.apache.harmony.xnet.provider.jsse.OpenSSLSocketImpl').verifyCertificateChain.implementation = function() {
                console.log('[+] Apache Harmony bypassed');
            };
        } catch (err) {}

        // PhoneGap
        try {
            Java.use('nl.xservices.plugins.sslCertificateChecker').execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext').implementation = function(a, b, c) {
                console.log('[+] PhoneGap bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        // IBM MobileFirst
        try {
            var wlclient = Java.use('com.worklight.wlclient.api.WLClient').getInstance();
            wlclient.pinTrustedCertificatePublicKey.overload('java.lang.String').implementation = function(cert) { console.log('[+] IBM MobileFirst {1} bypassed'); };
            wlclient.pinTrustedCertificatePublicKey.overload('[Ljava.lang.String;').implementation = function(cert) { console.log('[+] IBM MobileFirst {2} bypassed'); };
        } catch (err) {}

        // IBM WorkLight
        try {
            var wl = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
            wl.verify.overload('java.lang.String', 'javax.net.ssl.SSLSocket').implementation = function(a, b) { console.log('[+] WorkLight {1}: ' + a); };
            wl.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function(a, b) { console.log('[+] WorkLight {2}: ' + a); };
            wl.verify.overload('java.lang.String', '[Ljava.lang.String;', '[Ljava.lang.String;').implementation = function(a, b) { console.log('[+] WorkLight {3}: ' + a); };
            wl.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function(a, b) { console.log('[+] WorkLight {4}: ' + a); return true; };
        } catch (err) {}

        // Conscrypt CertPinManager
        try {
            Java.use('com.android.org.conscrypt.CertPinManager').checkChainPinning.overload('java.lang.String', 'java.util.List').implementation = function(a, b) {
                console.log('[+] Conscrypt CertPinManager bypassed: ' + a);
            };
        } catch (err) {}

        // Conscrypt CertPinManager Legacy
        try {
            Java.use('com.android.org.conscrypt.CertPinManager').isChainValid.overload('java.lang.String', 'java.util.List').implementation = function(a, b) {
                console.log('[+] Conscrypt CertPinManager (Legacy) bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        // CWAC-Netsecurity
        try {
            Java.use('com.commonsware.cwac.netsecurity.conscrypt.CertPinManager').isChainValid.overload('java.lang.String', 'java.util.List').implementation = function(a, b) {
                console.log('[+] CWAC-Netsecurity bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        // Worklight Androidgap
        try {
            Java.use('com.worklight.androidgap.plugin.WLCertificatePinningPlugin').execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext').implementation = function(a, b, c) {
                console.log('[+] Worklight Androidgap bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        // Netty
        try {
            Java.use('io.netty.handler.ssl.util.FingerprintTrustManagerFactory').checkTrusted.implementation = function(type, chain) {
                console.log('[+] Netty bypassed');
            };
        } catch (err) {}

        // Squareup OkHTTP < v3
        try {
            var sq = Java.use('com.squareup.okhttp.CertificatePinner');
            sq.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function(a, b) { console.log('[+] Squareup {1}: ' + a); };
            sq.check.overload('java.lang.String', 'java.util.List').implementation = function(a, b) { console.log('[+] Squareup {2}: ' + a); };
        } catch (err) {}

        // Squareup OkHostnameVerifier
        try {
            var sqv = Java.use('com.squareup.okhttp.internal.tls.OkHostnameVerifier');
            sqv.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function(a, b) { console.log('[+] Squareup Verifier {1}: ' + a); return true; };
            sqv.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function(a, b) { console.log('[+] Squareup Verifier {2}: ' + a); return true; };
        } catch (err) {}

        // Android WebViewClient
        try {
            var wvc = Java.use('android.webkit.WebViewClient');
            wvc.onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError').implementation = function(v, h, e) {
                console.log('[+] WebViewClient {1} bypassed');                
                    h.proceed();
            };
            wvc.onReceivedError.implementation = function(view, errCode, description, failingUrl) {
                console.log('[+] WebViewClient {2} bypassed');
            };
            wvc.onReceivedError.overload('android.webkit.WebView', 'android.webkit.WebResourceRequest', 'android.webkit.WebResourceError').implementation = function(v, r, e) {
                console.log('[+] WebViewClient {3} bypassed');
            };
        } catch (err) {}

        // Apache Cordova
        try {
            Java.use('org.apache.cordova.CordovaWebViewClient').onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError').implementation = function(v, h, e) {
                console.log('[+] Apache Cordova bypassed');
                h.proceed();
            };
        } catch (err) {}

        // Boye AbstractVerifier
        try {
            Java.use('ch.boye.httpclientandroidlib.conn.ssl.AbstractVerifier').verify.implementation = function(host, ssl) {
                console.log('[+] Boye AbstractVerifier bypassed: ' + host);
            };
        } catch (err) {}

        // Apache AbstractVerifier
        try {
            var av = Java.use('org.apache.http.conn.ssl.AbstractVerifier');
            av.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function(a, b) { console.log('[+] Apache Verifier {1}: ' + a); };
            av.verify.overload('java.lang.String', 'javax.net.ssl.SSLSocket').implementation = function(a, b) { console.log('[+] Apache Verifier {2}: ' + a); };
            av.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function(a, b) { console.log('[+] Apache Verifier {3}: ' + a); };
            av.verify.overload('java.lang.String', '[Ljava.lang.String;', '[Ljava.lang.String;', 'boolean').implementation = function(a, b, c, d) { console.log('[+] Apache Verifier {4}: ' + a); };
        } catch (err) {}

        // Flutter Pinning
        try {
            Java.use('diefferson.http_certificate_pinning.HttpCertificatePinning').checkConnexion.overload("java.lang.String", "java.util.List", "java.util.Map", "int", "java.lang.String").implementation = function (a, b, c ,d, e) {
                console.log('[+] Flutter HttpCertificatePinning bypassed: ' + a);
                return true;
            };
        } catch (err) {}
        
        // Flutter SslPinningPlugin
        try {
            Java.use('com.macif.plugin.sslpinningplugin.SslPinningPlugin').checkConnexion.overload("java.lang.String", "java.util.List", "java.util.Map", "int", "java.lang.String").implementation = function (a, b, c ,d, e) {
                console.log('[+] Flutter SslPinningPlugin bypassed: ' + a);
                return true;
            };
        } catch (err) {}

        // Appmattus Certificate Transparency
        try {
            Java.use('com.appmattus.certificatetransparency.internal.verifier.CertificateTransparencyInterceptor')["intercept"].implementation = function(a) {
                console.log('[+] Appmattus Transparency bypassed');
                return a.proceed(a.request());
            };
        } catch (err) {}
        
        // Appmattus Certificate Transparency TrustManager
        try {
            var ct = Java.use('com.appmattus.certificatetransparency.internal.verifier.CertificateTransparencyTrustManager');
            ct["checkServerTrusted"].overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String').implementation = function() { console.log('[+] Appmattus TM {1} bypassed'); };
            ct["checkServerTrusted"].overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String').implementation = function() { console.log('[+] Appmattus TM {2} bypassed'); return Java.use("java.util.ArrayList").$new(); };
        } catch (err) {}

        // Cronet
        try {
            var CronetEngineBuilderImpl = Java.use("org.chromium.net.impl.CronetEngineBuilderImpl");

            CronetEngineBuilderImpl.enablePublicKeyPinningBypassForLocalTrustAnchors.implementation = function(bypass) {
                console.log("[+] Cronet Public Key Pinning Bypass forced");
                return this.enablePublicKeyPinningBypassForLocalTrustAnchors(true);
            };

            CronetEngineBuilderImpl.addPublicKeyPins.implementation = function() {
                console.log("[+] Cronet addPublicKeyPins blocked");
                return this;
            };

            console.log("[+] Cronet hooks installed");
        } catch (err) {
            console.log("[-] Cronet not found");
        }

        // Network Security Config
        try {
            var NetworkSecurityConfig = Java.use("android.security.net.config.NetworkSecurityConfig");
            NetworkSecurityConfig.isCleartextTrafficPermitted.overload().implementation = function() {
                console.log("[+] NSC cleartext allowed");
                return true;
            };
        } catch (e) {}

        // Network Security Config - Pinned certs
        try {
            var Domain = Java.use("android.security.net.config.Domain");
            Domain.getPinnedCertificates.implementation = function() {
                console.log("[+] NSC pinned certs cleared");
                return Java.use("java.util.Set").$new();
            };
        } catch (e) {}

        // SSLSocketFactory / generic HostnameVerifier  
        try {
            var SSLSocketFactory = Java.use("javax.net.ssl.SSLSocketFactory");
            SSLSocketFactory.createSocket.overload(
                "java.net.Socket", "java.lang.String", "int", "boolean"
            ).implementation = function(s, host, port, autoClose) {
                console.log("[+] SSLSocketFactory.createSocket -> " + host + ":" + port);
                return this.createSocket(s, host, port, autoClose);
            };
        } catch (e) {}

        // Generic HostnameVerifier
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

            var HttpsURLConnection2 = Java.use("javax.net.ssl.HttpsURLConnection");
            HttpsURLConnection2.setDefaultHostnameVerifier.implementation = function(hv) {
                console.log("[+] setDefaultHostnameVerifier overridden");
                this.setDefaultHostnameVerifier(AlwaysTrue.$new());
            };
        } catch (e) {}

        // Dynamic SSLPeerUnverifiedException Bypasser (TODO: Is it duplicated?)
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
                    
                    if (className == 'com.android.org.conscrypt.ActiveSession' || className == 'com.google.android.gms.org.conscrypt.ActiveSession') {
                        throw 'Skipped: non-blocking';
                    }
                    
                    console.log('\x1b[36m[!] SSLPeerUnverifiedException in '+className+'.'+methodName+'\x1b[0m');
                    var callingMethod = Java.use(className)[methodName];
                    var retTypeName = callingMethod.returnType.type;
                    
                    if (!callingMethod.implementation) {
                        callingMethod.implementation = function() {
                            console.log('\x1b[34m[+] Bypassed unusual pinner '+className+'.'+methodName+'\x1b[0m');
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

        console.log("[+] SSL Pinning bypass completed");
    });
}, 0);

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

function returner(typeName) {
    return (typeName === undefined || typeName === 'void') ? undefined : (typeName === 'boolean' ? true : null);
}

function overloader(errStr, targetClass, targetFunc, retType) {
    var tClass = Java.use(targetClass);
    var tFunc = tClass[targetFunc];
    var splittedList = String(errStr).split('.overload');
    
    for (var n=1; n<splittedList.length; n++) {
        var extractedOverload = splittedList[n].trim().split('(')[1].slice(0,-1).replace(/'/g, "");
        if (extractedOverload.indexOf('<signature>') !== -1) continue;
        
        console.log('\x1b[34m[!] Found unusual pinner '+targetClass+'.'+targetFunc+'('+extractedOverload+')\x1b[0m');
        var argList = extractedOverload ? extractedOverload.split(', ') : [];
        
        try {
            if (argList.length == 0) {
                tFunc.overload().implementation = function() {
                    console.log('\x1b[34m[+] Bypassed unusual pinner\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length == 1) {
                tFunc.overload(argList[0]).implementation = function(a) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            } else if (argList.length == 2) {
                tFunc.overload(argList[0], argList[1]).implementation = function(a,b) {
                    console.log('\x1b[34m[+] Bypassed: ' + a + '\x1b[0m');
                    return returner(retType);
                };
            }
        } catch(e) {}
    }
}

// ========================================================================
// NATIVE SSL BYPASS
// ========================================================================

function hook_libssl() {
    // Common OpenSSL functions to hook for SSL pinning bypass
    try {
        var module = Process.getModuleByName("libssl.so");
        console.log("[+] libssl base:", module.base);

        Interceptor.attach(module.getExportByName("SSL_write"), {
            onEnter: function(args) {
                console.log("[SSL] write");
            }
        });

        Interceptor.attach(module.getExportByName("SSL_read"), {
            onEnter: function(args) {
                console.log("[SSL] read");
            }
        });

        Interceptor.attach(module.getExportByName("X509_verify_cert"), {
            onLeave: function(retval) {
                console.log("[+] Bypassing X509_verify_cert");
                retval.replace(1);
            }
        });

        Interceptor.attach(module.getExportByName("SSL_get_verify_result"), {
            onLeave: function(retval) {
                retval.replace(0);
            }
        });

        console.log("[+] libssl hooks installed");
    } catch (e) {
        console.log("[-] Error hooking libssl:", e);
    }
}

// Hook android_dlopen_ext correctly
try {
    var libdl = Process.getModuleByName("libdl.so");
    var android_dlopen_ext = libdl.getExportByName("android_dlopen_ext");

    Interceptor.attach(android_dlopen_ext, {
        onEnter: function(args) {
            this.libname = args[0].readCString();
        },
        onLeave: function(retval) {
            if (this.libname && this.libname.indexOf("libssl.so") !== -1) {
                console.log("[+] libssl loaded:", this.libname);
                hook_libssl();
            }
        }
    });
} catch (e) {
    console.log("[-] Failed to hook android_dlopen_ext:", e);
}

setTimeout(function() {
    try {
        Process.getModuleByName("libssl.so");
        console.log("[*] libssl already loaded, hooking now...");
        hook_libssl();
    } catch (e) {}
}, 1000);

console.log("");
console.log("======================================================");
console.log("[+] FRIDA UNIFIED BYPASS LOADED SUCCESSFULLY!");
console.log("======================================================");
console.log("");