package com.thaissh.web;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.Process;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service ที่ทำให้ process ของแอป (และ Node.js ที่ถือ SSH session) อยู่รอดเมื่อสลับไปแอปอื่น
 * — เทียบเท่า SshSessionService ของแอป Android เดิม
 */
public class SessionService extends Service {

    private static final String CHANNEL_ID = "thaissh_sessions";
    private static final int NOTIFICATION_ID = 1;
    static final String ACTION_QUIT = "com.thaissh.web.QUIT";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_QUIT.equals(intent.getAction())) {
            // ปิดทั้งแอป: SSH ทุก session จบ, Node.js จะเริ่มใหม่ตอนเปิดแอปครั้งหน้า
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            Process.killProcess(Process.myPid());
            return START_NOT_STICKY;
        }

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "SSH sessions", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("แสดงขณะ ThaiSSH ทำงานเบื้องหลัง");
            nm.createNotificationChannel(channel);
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), piFlags);
        PendingIntent quit = PendingIntent.getService(this, 1,
            new Intent(this, SessionService.class).setAction(ACTION_QUIT), piFlags);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_terminal)
            .setContentTitle("ThaiSSH ทำงานอยู่")
            .setContentText("SSH session ยังเชื่อมต่ออยู่เบื้องหลัง")
            .setContentIntent(open)
            .addAction(0, "ปิดแอป", quit)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
