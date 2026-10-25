package com.thaissh.web;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        ContextCompat.startForegroundService(this, new Intent(this, SessionService.class));
        styleSystemBars();

        // ปุ่ม back: ย้อนในหน้าเว็บถ้าทำได้ ไม่งั้นพับแอปไปเบื้องหลัง (ไม่ปิด) เพื่อให้ SSH session อยู่ต่อ
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    /** แสดงแถบสถานะ/แถบนำทางตามปกติ บนพื้นสีเดียวกับ terminal และไอคอนสีอ่อน */
    private void styleSystemBars() {
        getWindow().getDecorView().setBackgroundColor(TERM_BG);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }

    private static final int TERM_BG = 0xFF0D0F14;

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (isFinishing()) {
            // capacitor-nodejs สตาร์ท Node.js ซ้ำใน process เดิมไม่ได้
            // ถ้า activity ถูกปิดจริง (เช่นปัดทิ้งจาก recent apps) ให้จบ process เพื่อเริ่มใหม่สะอาด ๆ ครั้งหน้า
            stopService(new Intent(this, SessionService.class));
            Process.killProcess(Process.myPid());
        }
    }
}
