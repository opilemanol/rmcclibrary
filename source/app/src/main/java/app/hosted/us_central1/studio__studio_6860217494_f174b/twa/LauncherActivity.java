package app.hosted.us_central1.studio__studio_6860217494_f174b.twa;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class LauncherActivity extends AppCompatActivity {

    private WebView myWebView;
    private AdView mAdView;
    private LinearLayout offlineLayout, splashLayout;
    private Button btnRetry;
    private final String APP_URL = "https://studio--studio-6860217494-f174b.us-central1.hosted.app/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 1. Initialize Views
        myWebView = findViewById(R.id.webview);
        offlineLayout = findViewById(R.id.offline_layout);
        splashLayout = findViewById(R.id.splash_layout);
        btnRetry = findViewById(R.id.btn_retry);

        // 2. Initialize AdMob
        MobileAds.initialize(this, initializationStatus -> {});
        mAdView = findViewById(R.id.adView);
        AdRequest adRequest = new AdRequest.Builder().build();
        mAdView.loadAd(adRequest);

        // 3. Setup WebView
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidShare");

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                splashLayout.setVisibility(View.GONE);
                offlineLayout.setVisibility(View.GONE);
                myWebView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                showOffline();
            }
        });

        btnRetry.setOnClickListener(v -> startApp());

        // 4. Start Logic
        startApp();
    }

    private void startApp() {
        if (isNetworkAvailable()) {
            offlineLayout.setVisibility(View.GONE);
            splashLayout.setVisibility(View.VISIBLE);
            myWebView.loadUrl(APP_URL);
        } else {
            showOffline();
        }
    }

    private void showOffline() {
        myWebView.setVisibility(View.GONE);
        splashLayout.setVisibility(View.GONE);
        offlineLayout.setVisibility(View.VISIBLE);
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
        return activeNetworkInfo != null && activeNetworkInfo.isConnected();
    }

    public class WebAppInterface {
        
        // Your old text sharing option remains untouched
        @JavascriptInterface
        public void share(String title, String text, String url) {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.putExtra(Intent.EXTRA_TEXT, text + " " + url);
            startActivity(Intent.createChooser(shareIntent, "Share Sermon/Devotional"));
        }

        // NEW METHOD: Call this method from web app JavaScript to trigger PDF sharing
        @JavascriptInterface
        public void sharePDF(String base64Pdf, String fileName) {
            try {
                // If the string contains data URI prefix (e.g. "data:application/pdf;base64,"), strip it away
                if (base64Pdf.contains(",")) {
                    base64Pdf = base64Pdf.split(",")[1];
                }

                // Decode base64 to byte array
                byte[] pdfAsBytes = Base64.decode(base64Pdf, Base64.DEFAULT);

                // Save PDF to internal app cache (no storage permission needed!)
                File cachePath = new File(getCacheDir(), "shared_pdfs");
                cachePath.mkdirs(); // Ensure directory exists
                File pdfFile = new File(cachePath, fileName != null ? fileName : "Document.pdf");
                
                FileOutputStream stream = new FileOutputStream(pdfFile);
                stream.write(pdfAsBytes);
                stream.close();

                // Get secure content URI via FileProvider
                Uri contentUri = FileProvider.getUriForFile(
                        LauncherActivity.this, 
                        getPackageName() + ".fileprovider", 
                        pdfFile
                );

                if (contentUri != null) {
                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("application/pdf");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    
                    // Grant permission temporarily to any receiving app
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    
                    startActivity(Intent.createChooser(shareIntent, "Share Form PDF via"));
                }

            } catch (IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(LauncherActivity.this, "Failed to prepare PDF for sharing", Toast.LENGTH_SHORT).show());
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack() && myWebView.getVisibility() == View.VISIBLE) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}