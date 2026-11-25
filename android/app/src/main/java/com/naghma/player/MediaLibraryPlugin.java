package com.naghma.player;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;

@CapacitorPlugin(
    name = "MediaLibrary",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "legacyAudio", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class MediaLibraryPlugin extends Plugin {
    @PluginMethod
    public void scan(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        if (getPermissionState(alias) != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, "permissionResult");
            return;
        }
        scanGranted(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
        if (getPermissionState(alias) == com.getcapacitor.PermissionState.GRANTED) {
            scanGranted(call);
        } else {
            call.reject("Audio library permission was not granted", "PERMISSION_DENIED");
        }
    }

    private void scanGranted(PluginCall call) {
        JSArray result = new JSArray();
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.RELATIVE_PATH
        };
        String selection = MediaStore.Audio.Media.MIME_TYPE + " LIKE ?";
        String[] selectionArgs = { "audio/%" };
        String sort = MediaStore.Audio.Media.DATE_ADDED + " DESC";
        File cache = new File(getContext().getCacheDir(), "naghma-library");
        if (!cache.exists() && !cache.mkdirs()) {
            call.reject("Unable to create media cache");
            return;
        }

        try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, sort
        )) {
            if (cursor != null) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                int pathCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.RELATIVE_PATH);

                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idCol);
                    String name = cursor.getString(nameCol);
                    if (name == null || name.trim().isEmpty()) name = "audio-" + id;
                    Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                    File target = new File(cache, id + "-" + name.replaceAll("[^a-zA-Z0-9._-]", "_"));
                    if (!target.exists() || target.length() != cursor.getLong(sizeCol)) {
                        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                             FileOutputStream out = new FileOutputStream(target)) {
                            if (in == null) continue;
                            byte[] buffer = new byte[64 * 1024];
                            int read;
                            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                        } catch (Exception copyError) {
                            if (target.exists()) target.delete();
                            continue;
                        }
                    }
                    JSObject item = new JSObject();
                    item.put("id", String.valueOf(id));
                    item.put("name", name);
                    item.put("title", cursor.getString(titleCol));
                    item.put("artist", cursor.getString(artistCol));
                    item.put("album", cursor.getString(albumCol));
                    item.put("duration", cursor.getLong(durationCol));
                    item.put("size", cursor.getLong(sizeCol));
                    item.put("path", cursor.getString(pathCol) == null ? "" : cursor.getString(pathCol));
                    item.put("filePath", target.getAbsolutePath());
                    result.put(item);
                }
            }
            JSObject response = new JSObject();
            response.put("items", result);
            response.put("count", result.length());
            call.resolve(response);
        } catch (Exception e) {
            call.reject("Media scan failed: " + e.getMessage(), e);
        }
    }
}
