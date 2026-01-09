"use client";

import { useEffect } from "react";
import sdk from "@farcaster/frame-sdk";

export default function FarcasterLifecycle() {
    useEffect(() => {
        const init = async () => {
            try {
                // Tell Farcaster the app is ready to hide the splash screen
                await sdk.actions.ready();
                console.log("Farcaster SDK ready called");
            } catch (error) {
                console.error("Error initializing Farcaster SDK:", error);
            }
        };

        init();
    }, []);

    return null;
}
