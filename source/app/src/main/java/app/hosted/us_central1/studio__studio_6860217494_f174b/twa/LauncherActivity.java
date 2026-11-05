package app.hosted.us_central1.studio__studio_6860217494_f174b.twa;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebResourceErrorCompat;

import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

import org.json.JSONObject;

public class LauncherActivity extends AppCompatActivity {

    private static final String APP_URL = "https://appassets.androidplatform.net/index.html";
    private static final int MAX_PDF_BYTES = 15 * 1024 * 1024;
    private WebView webView;
    private AdView adView;
    private WebViewAssetLoader assetLoader;
    private InterstitialAd interstitialAd;
    private boolean interstitialLoading;
    private String pendingShareRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        adView = findViewById(R.id.adView);
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidShare");
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceErrorCompat error) {
                if (request.isForMainFrame()) {
                    runOnUiThread(() -> Toast.makeText(
                            LauncherActivity.this,
                            "The bundled library could not be opened. Please restart the app.",
                            Toast.LENGTH_LONG
                    ).show());
                }
            }
        });

        MobileAds.initialize(this, initializationStatus -> runOnUiThread(this::loadInterstitialAd));
        if (adView != null) {
            adView.loadAd(new AdRequest.Builder().build());
        }

        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (adView != null) adView.resume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (adView != null) adView.pause();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (adView != null) adView.destroy();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidShare");
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.rmccHandleBack ? window.rmccHandleBack() : false",
                    result -> {
                        if (!"true".equals(result)) LauncherActivity.super.onBackPressed();
                    }
            );
            return;
        }
        super.onBackPressed();
    }

    private void sharePdf(File file) {
        try {
            Uri contentUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    file
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, "Share RMCC document"));
        } catch (ActivityNotFoundException | IllegalArgumentException error) {
            Toast.makeText(this, "No app is available to share this PDF.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showShareError() {
        Toast.makeText(this, "Could not prepare the document for sharing.", Toast.LENGTH_SHORT).show();
    }

    private void loadInterstitialAd() {
        String adUnitId = BuildConfig.INTERSTITIAL_AD_UNIT_ID;
        if (adUnitId == null || adUnitId.trim().isEmpty() || interstitialLoading || interstitialAd != null) return;
        interstitialLoading = true;
        InterstitialAd.load(this, adUnitId, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(InterstitialAd ad) {
                interstitialLoading = false;
                interstitialAd = ad;
                if (pendingShareRequest != null) showInterstitialForRequest(pendingShareRequest);
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                interstitialLoading = false;
                interstitialAd = null;
                if (pendingShareRequest != null) {
                    String requestId = pendingShareRequest;
                    pendingShareRequest = null;
                    notifyWebAdResult(requestId, false);
                }
            }
        });
    }

    private void showInterstitialForRequest(String requestId) {
        InterstitialAd ad = interstitialAd;
        if (ad == null || requestId == null) {
            notifyWebAdResult(requestId, false);
            return;
        }
        interstitialAd = null;
        pendingShareRequest = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                notifyWebAdShown(requestId);
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                notifyWebAdResult(requestId, true);
                loadInterstitialAd();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                notifyWebAdResult(requestId, false);
                loadInterstitialAd();
            }
        });
        try {
            ad.show(LauncherActivity.this);
        } catch (RuntimeException error) {
            notifyWebAdResult(requestId, false);
            loadInterstitialAd();
        }
    }

    private void notifyWebAdResult(String requestId, boolean shown) {
        if (webView == null || requestId == null) return;
        String quotedId = JSONObject.quote(requestId);
        webView.evaluateJavascript(
                "window.onNativeAdResult && window.onNativeAdResult(" + quotedId + "," + shown + ")",
                null
        );
    }

    private void notifyWebAdShown(String requestId) {
        if (webView == null || requestId == null) return;
        String quotedId = JSONObject.quote(requestId);
        webView.evaluateJavascript(
                "window.onNativeAdShown && window.onNativeAdShown(" + quotedId + ")",
                null
        );
    }

    public class WebAppInterface {
        private final Context context;

        WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void showInterstitial(String requestId) {
            runOnUiThread(() -> {
                if (requestId == null || requestId.length() > 80 || interstitialLoading) {
                    notifyWebAdResult(requestId, false);
                    return;
                }
                if (interstitialAd != null) {
                    showInterstitialForRequest(requestId);
                } else {
                    pendingShareRequest = requestId;
                    loadInterstitialAd();
                    if (!interstitialLoading && pendingShareRequest != null) {
                        pendingShareRequest = null;
                        notifyWebAdResult(requestId, false);
                    }
                }
            });
        }

        @JavascriptInterface
        public void cancelInterstitial(String requestId) {
            runOnUiThread(() -> {
                if (requestId != null && requestId.equals(pendingShareRequest)) {
                    pendingShareRequest = null;
                }
            });
        }

        @JavascriptInterface
        public void share(String title, String text, String url) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_SUBJECT, title);
                intent.putExtra(Intent.EXTRA_TEXT, (text == null ? "" : text) + (url == null || url.isEmpty() ? "" : " " + url));
                try {
                    context.startActivity(Intent.createChooser(intent, "Share RMCC resource"));
                } catch (ActivityNotFoundException error) {
                    Toast.makeText(context, "No app is available to share this resource.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void sharePDF(String base64Pdf, String fileName) {
            try {
                if (base64Pdf == null || base64Pdf.length() > 22 * 1024 * 1024) {
                    throw new IllegalArgumentException("PDF is too large.");
                }
                int separator = base64Pdf.indexOf(',');
                String encoded = separator >= 0 ? base64Pdf.substring(separator + 1) : base64Pdf;
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_PDF_BYTES) {
                    throw new IllegalArgumentException("Invalid PDF size.");
                }

                File cacheDirectory = new File(getCacheDir(), "shared_pdfs");
                if (!cacheDirectory.exists() && !cacheDirectory.mkdirs()) {
                    throw new IOException("Unable to create the PDF cache.");
                }
                File[] cachedFiles = cacheDirectory.listFiles();
                if (cachedFiles != null) {
                    long expiration = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
                    for (File cachedFile : cachedFiles) {
                        if (cachedFile.isFile() && cachedFile.lastModified() < expiration) {
                            cachedFile.delete();
                        }
                    }
                }
                String safeName = fileName == null ? "RMCC-Document.pdf" : fileName.replaceAll("[^A-Za-z0-9._-]", "_");
                if (safeName.isEmpty() || !safeName.toLowerCase().endsWith(".pdf")) {
                    safeName = "RMCC-Document.pdf";
                }
                File pdfFile = new File(cacheDirectory, safeName);
                try (FileOutputStream stream = new FileOutputStream(pdfFile)) {
                    stream.write(bytes);
                }
                runOnUiThread(() -> sharePdf(pdfFile));
            } catch (IOException | IllegalArgumentException error) {
                runOnUiThread(LauncherActivity.this::showShareError);
            }
        }
    }
}
