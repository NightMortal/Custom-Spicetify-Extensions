(async () => {
    // Wait for Spicetify to be ready
    while (!Spicetify.React || !Spicetify.ReactDOM || !Spicetify.Platform || !Spicetify.URI) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    console.log("Spicetify is ready.");

    // Function to get album art URL
    async function getAlbumArt(uri) {
        try {
            console.log(`Fetching album art for URI: ${uri}`);
            const albumData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${uri}`);
            return albumData.images[0]?.url || null;
        } catch (error) {
            console.error("Failed to fetch album art:", error);
            return null;
        }
    }

    // Function to get artist banner/header image from the Spotify API
    async function getArtistBanner(artistUri) {
        try {
            const artistData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistUri.id}`);
            if (artistData.images && artistData.images.length > 0) {
                const bannerUrl = artistData.images[0].url; // Use the first image as the banner
                if (bannerUrl) {
                    console.log("Banner URL found:", bannerUrl);
                    return bannerUrl; // Return the URL of the banner
                }
            }
        } catch (error) {
            console.error("Failed to fetch artist banner:", error);
        }
        console.error("No artist banner URL found.");
        return null; // Return null if no banner is found
    }

    // Function to get artist profile picture URL from the Spotify API
    async function getArtistProfilePicture(artistUri) {
        try {
            const artistData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistUri.id}`);
            if (artistData.images && artistData.images.length > 0) {
                const profilePictureUrl = artistData.images[0].url; // Use the first image as the profile picture
                console.log("Profile picture URL found:", profilePictureUrl);
                return profilePictureUrl; // Return the URL of the profile picture
            }
        } catch (error) {
            console.error("Failed to fetch artist profile picture:", error);
        }
        console.error("No artist profile picture URL found.");
        return null; // Return null if no profile picture is found
    }

    // Function to copy URL to clipboard
    async function copyUrlToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            Spicetify.showNotification("URL copied to clipboard!");
        } catch (error) {
            console.error("Failed to copy URL:", error);
            Spicetify.showNotification("Failed to copy URL.");
        }
    }

    // Global variables for menus
    let artistMenu = null;
    const albumArtMenu = new Spicetify.ContextMenu.SubMenu("Album Art", [
        new Spicetify.ContextMenu.Item("Open Image", async (selected) => {
            const uri = Spicetify.URI.fromString(selected[0]);
            if (uri.type === Spicetify.URI.Type.TRACK) {
                console.log("Fetching album art for track:", uri.id);
                const trackData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${uri.id}`);
                const albumArtUrl = await getAlbumArt(trackData.album.id);
                if (albumArtUrl) {
                    window.open(albumArtUrl, "_blank");
                } else {
                    console.error("No album art URL found.");
                }
            }
        }),
        new Spicetify.ContextMenu.Item("Copy URL", async (selected) => {
            const uri = Spicetify.URI.fromString(selected[0]);
            if (uri.type === Spicetify.URI.Type.TRACK) {
                console.log("Copying album art URL for track:", uri.id);
                const trackData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${uri.id}`);
                const albumArtUrl = await getAlbumArt(trackData.album.id);
                if (albumArtUrl) await copyUrlToClipboard(albumArtUrl);
                else console.error("No album art URL found to copy.");
            }
        })
    ], (selected) => {
        const uri = Spicetify.URI.fromString(selected[0]);
        return uri.type === Spicetify.URI.Type.TRACK || uri.type === Spicetify.URI.Type.ALBUM; // Show menu for track or album
    });

    // Create artist context menu
    function createArtistContextMenu(artistUri) {
        // Deregister existing artist menu if it exists
        if (artistMenu) {
            artistMenu.deregister();
            console.log("Deregistering existing artist menu.");
        }

        console.log("Creating artist context menu for URI:", artistUri);

        if (!artistUri) {
            console.error("Invalid artist URI provided:", artistUri);
            return;
        }

        // Create artist-specific context menu
        artistMenu = new Spicetify.ContextMenu.SubMenu("Artist Options", [
            new Spicetify.ContextMenu.Item("Open Profile Picture", async () => {
                console.log("Attempting to get artist profile picture URL..."); // Log before calling
                const artistPicUrl = await getArtistProfilePicture(artistUri); // Use the Spotify API here
                if (artistPicUrl) {
                    console.log("Opening profile picture URL:", artistPicUrl); // Log the URL being opened
                    window.open(artistPicUrl, "_blank");
                } else {
                    console.error("No artist profile picture URL found.");
                }
            }),
            new Spicetify.ContextMenu.Item("Copy Profile Picture URL", async () => {
                const artistPicUrl = await getArtistProfilePicture(artistUri); // Use the Spotify API here
                if (artistPicUrl) await copyUrlToClipboard(artistPicUrl);
            }),
            new Spicetify.ContextMenu.Item("Open Banner", async () => {
                console.log("Attempting to get artist banner URL..."); // Log before calling
                const artistBannerUrl = await getArtistBanner(artistUri); // Use the API function here
                if (artistBannerUrl) {
                    console.log("Opening banner URL:", artistBannerUrl); // Log the URL being opened
                    window.open(artistBannerUrl, "_blank");
                } else {
                    console.error("No artist banner URL found.");
                    Spicetify.showNotification("No banner detected for this artist."); // Notify when no banner is found
                }
            }),
            new Spicetify.ContextMenu.Item("Copy Banner URL", async () => {
                const artistBannerUrl = await getArtistBanner(artistUri); // Use the API function here
                if (artistBannerUrl) {
                    await copyUrlToClipboard(artistBannerUrl);
                } else {
                    console.error("No artist banner URL found.");
                    Spicetify.showNotification("No banner detected for this artist."); // Notify when no banner is found
                }
            }),
        ], (selected) => {
            const uri = Spicetify.URI.fromString(selected[0]);
            return uri.type === Spicetify.URI.Type.ARTIST; // Show menu for artist only
        });

        artistMenu.register();
        console.log("Artist context menu registered.");
    }

    // Register the album art menu globally
    albumArtMenu.register();
    console.log("Album art context menu registered globally.");

    // Detect page changes to adjust context menus
    Spicetify.Platform.History.listen(({ pathname }) => {
        console.log("Page changed to:", pathname);
        const uri = Spicetify.URI.fromString(pathname);

        if (uri && uri.type === Spicetify.URI.Type.ARTIST) {
            console.log("Detected artist page:", uri.id);
            createArtistContextMenu(uri); // Pass the full URI object instead of just the ID
        } else {
            // If leaving an artist page, deregister artist menu
            if (artistMenu) {
                artistMenu.deregister();
                artistMenu = null;
                console.log("Leaving artist page. Deregistered artist menu.");
            }
        }
    });

    // Also check if we're already on an artist page when the script first runs
    const initialPath = window.location.pathname;
    const initialUri = Spicetify.URI.fromString(initialPath);

    if (initialUri && initialUri.type === Spicetify.URI.Type.ARTIST) {
        console.log("Detected initial artist page:", initialUri.id);
        createArtistContextMenu(initialUri); // Pass the full URI object instead of just the ID
    }
})();
