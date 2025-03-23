// NAME: Spotify Image Opener
// AUTHOR: NightMortal
// DESCRIPTION: Access album art, artist photos, and more with right-click context menus.
// VERSION: 1.0.0

(async () => {
    // Wait for Spicetify API
    while (!Spicetify?.Platform?.History || !Spicetify?.URI || !Spicetify?.Player || 
           !Spicetify?.ContextMenu || !Spicetify.React || !Spicetify.ReactDOM) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Get album art URL
    async function getAlbumArtUrl(uri) {
        try {
            let albumId;
            const uriObj = Spicetify.URI.from(uri);
            if (uriObj.type === Spicetify.URI.Type.TRACK) {
                const trackData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${uriObj.id}`);
                albumId = trackData.album.id;
            } else if (uriObj.type === Spicetify.URI.Type.ALBUM) {
                albumId = uriObj.id;
            } else {
                return null;
            }
            const albumData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${albumId}`);
            return albumData.images[0]?.url || null;
        } catch (error) {
            console.error("Failed to fetch album art:", error);
            return null;
        }
    }

    // Get artist banner from DOM
    function getArtistBanner() {
        const selectors = [
            '.main-view-container .under-main-view > div > div',
            '.main-view-container__scroll-node-child .main-entityHeader-background',
            '.main-entityHeader-background',
        ];

        for (const selector of selectors) {
            const bannerElement = document.querySelector(selector);
            if (bannerElement) {
                const style = window.getComputedStyle(bannerElement);
                const backgroundImage = style.backgroundImage;
                if (backgroundImage && backgroundImage !== 'none') {
                    const urlMatch = backgroundImage.match(/url\("?(.*?)"?\)/);
                    if (urlMatch && urlMatch[1]) return urlMatch[1];
                }
            }
        }
        return null;
    }

    // Get artist profile picture via API
    async function getArtistProfilePicture(artistUri) {
        try {
            const artistId = Spicetify.URI.from(artistUri).id;
            const artistData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistId}`);
            return artistData.images[0]?.url || null;
        } catch (error) {
            console.error("Failed to fetch artist profile picture:", error);
            return null;
        }
    }

    // Copy URL to clipboard
    async function copyUrlToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            Spicetify.showNotification("Copied to clipboard!");
        } catch (error) {
            Spicetify.showNotification("Failed to copy.");
        }
    }

    // Album Art Context Menu
    const albumArtContextMenu = new Spicetify.ContextMenu.SubMenu("Album Art", [
        new Spicetify.ContextMenu.Item("Open Image", async (uris) => {
            const albumArtUrl = await getAlbumArtUrl(uris[0]);
            if (albumArtUrl) window.open(albumArtUrl, "_blank");
            else Spicetify.showNotification("Album art not found.");
        }),
        new Spicetify.ContextMenu.Item("Copy URL", async (uris) => {
            const albumArtUrl = await getAlbumArtUrl(uris[0]);
            if (albumArtUrl) await copyUrlToClipboard(albumArtUrl);
            else Spicetify.showNotification("Album art not found.");
        })
    ], (uris) => {
        const uriObj = Spicetify.URI.from(uris[0]);
        return uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.ALBUM;
    });
    albumArtContextMenu.register();

    // Artist Context Menu
    let artistContextMenu = null;

    function createArtistContextMenu(artistUri, bannerUrl) {
        if (artistContextMenu) {
            artistContextMenu.deregister();
        }

        if (!artistUri) return;

        const menuItems = [
            new Spicetify.ContextMenu.Item("Open Profile Picture", async () => {
                const artistPicUrl = await getArtistProfilePicture(artistUri);
                if (artistPicUrl) window.open(artistPicUrl, "_blank");
                else Spicetify.showNotification("Profile picture not found.");
            }),
            new Spicetify.ContextMenu.Item("Copy Profile Picture URL", async () => {
                const artistPicUrl = await getArtistProfilePicture(artistUri);
                if (artistPicUrl) await copyUrlToClipboard(artistPicUrl);
                else Spicetify.showNotification("Profile picture not found.");
            })
        ];

        if (bannerUrl) {
            menuItems.push(
                new Spicetify.ContextMenu.Item("Open Banner Image", () => {
                    window.open(bannerUrl, "_blank");
                }),
                new Spicetify.ContextMenu.Item("Copy Banner URL", async () => {
                    await copyUrlToClipboard(bannerUrl);
                })
            );
        }

        artistContextMenu = new Spicetify.ContextMenu.SubMenu("Artist Options", menuItems, (uris) => {
            const uriObj = Spicetify.URI.from(uris[0]);
            return uriObj.type === Spicetify.URI.Type.ARTIST;
        });

        artistContextMenu.register();
    }

    function deregisterArtistContextMenu() {
        if (artistContextMenu) {
            artistContextMenu.deregister();
            artistContextMenu = null;
        }
    }

    function initializeArtistContextMenu(artistUri) {
        const bannerUrl = getArtistBanner();
        createArtistContextMenu(artistUri, bannerUrl);

        if (!bannerUrl) {
            const targetNode = document.querySelector('.main-view-container');
            if (!targetNode) return;

            const observer = new MutationObserver(() => {
                const updatedBannerUrl = getArtistBanner();
                if (updatedBannerUrl) {
                    createArtistContextMenu(artistUri, updatedBannerUrl);
                    observer.disconnect();
                }
            });
            observer.observe(targetNode, { childList: true, subtree: true });
        }
    }

    // Track page changes
    Spicetify.Platform.History.listen(({ pathname }) => {
        const uri = Spicetify.URI.from(pathname);
        if (uri && uri.type === Spicetify.URI.Type.ARTIST) {
            initializeArtistContextMenu(pathname);
        } else {
            deregisterArtistContextMenu();
        }
    });

    // Handle initial page
    const initialPath = window.location.pathname;
    const initialUri = Spicetify.URI.from(initialPath);
    if (initialUri && initialUri.type === Spicetify.URI.Type.ARTIST) {
        initializeArtistContextMenu(initialPath);
    }

    // Add context menu to player's album art
    function addAlbumArtContextMenu() {
        const albumArtImage = document.querySelector('.main-nowPlayingBar-container .cover-art-image');
        if (!albumArtImage) return;
        
        if (albumArtImage._albumContextMenuHandler) {
            albumArtImage.removeEventListener('contextmenu', albumArtImage._albumContextMenuHandler);
        }

        albumArtImage._albumContextMenuHandler = async (event) => {
            event.preventDefault();
            const track = Spicetify.Player.data.track;
            if (!track) return;
            
            const albumArtUrl = await getAlbumArtUrl(track.uri);
            if (albumArtUrl) {
                const menu = new Spicetify.ContextMenu.SubMenu("", [
                    new Spicetify.ContextMenu.Item("Open Image", () => {
                        window.open(albumArtUrl, "_blank");
                    }),
                    new Spicetify.ContextMenu.Item("Copy URL", async () => {
                        await copyUrlToClipboard(albumArtUrl);
                    })
                ]);
                menu.show(event.clientX, event.clientY);
            } else {
                Spicetify.showNotification("Album art not found.");
            }
        };

        albumArtImage.addEventListener('contextmenu', albumArtImage._albumContextMenuHandler);
    }

    // Initialize extension
    function initialSetup() {
        addAlbumArtContextMenu();
    }
    
    initialSetup();

    // Refresh on song change
    Spicetify.Player.addEventListener("songchange", addAlbumArtContextMenu);

    // Global observer for page changes
    const bodyObserver = new MutationObserver((mutations) => {
        if (mutations.some(m => m.addedNodes.length > 0 || m.attributeName === 'class')) {
            initialSetup();
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
})();