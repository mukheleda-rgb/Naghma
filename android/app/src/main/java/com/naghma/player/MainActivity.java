package com.naghma.player;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MediaLibraryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
