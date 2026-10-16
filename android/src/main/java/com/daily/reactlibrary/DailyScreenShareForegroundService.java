package com.daily.reactlibrary;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/** Foreground service for media projection while screen sharing (Android 14+ requirement). */
public class DailyScreenShareForegroundService extends Service {

    private static final String TAG = DailyScreenShareForegroundService.class.getName();
    private static final String NOTIFICATION_CHANNEL_ID = "dailyScreenShareNotificationChannel";
    private static final int NOTIFICATION_ID = 2;

    public static void start(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannel(context);
        }
        Intent intent = new Intent(context, DailyScreenShareForegroundService.class);
        try {
            ContextCompat.startForegroundService(context, intent);
        } catch (SecurityException | IllegalStateException e) {
            Log.e(TAG, "Failed to start screen share foreground service", e);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, DailyScreenShareForegroundService.class));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("Screen sharing")
                .setContentText("Daily is sharing your screen.")
                .setSmallIcon(android.R.drawable.presence_video_online)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (SecurityException | IllegalStateException e) {
            Log.e(TAG, "Failed to promote screen share service to foreground", e);
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static void createNotificationChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Daily Screen Share",
                NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
