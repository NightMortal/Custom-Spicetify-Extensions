(async () => {
    // Wait for Spicetify to be ready
    while (
        !Spicetify?.Platform?.History ||
        !Spicetify?.URI ||
        !Spicetify?.Player ||
        !Spicetify?.ContextMenu ||
        !Spicetify.React ||
        !Spicetify.ReactDOM
    ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Spicetify is ready.");

    // Function to get album art URL
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

    // Function to get artist banner/header image from the DOM
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
                    if (urlMatch && urlMatch[1]) {
                        console.log(`Banner URL found using selector "${selector}":`, urlMatch[1]);
                        return urlMatch[1];
                    }
                }
            }
        }

        console.warn("No artist banner URL found in the DOM.");
        return null;
    }

    // Function to get artist profile picture URL using Spotify API
    async function getArtistProfilePicture(artistUri) {
        try {
            const artistId = Spicetify.URI.from(artistUri).id;
            const artistData = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${artistId}`);
            const profilePicUrl = artistData.images[0]?.url;
            if (profilePicUrl) {
                console.log("Profile picture URL found:", profilePicUrl);
                return profilePicUrl;
            }
        } catch (error) {
            console.error("Failed to fetch artist profile picture:", error);
        }
        console.warn("No artist profile picture URL found.");
        return null;
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

    // Create Album Art Context Menu
    const albumArtContextMenu = new Spicetify.ContextMenu.SubMenu("Album Art", [
        new Spicetify.ContextMenu.Item("Open Image", async (uris) => {
            const uri = uris[0];
            const albumArtUrl = await getAlbumArtUrl(uri);
            if (albumArtUrl) {
                window.open(albumArtUrl, "_blank");
            } else {
                Spicetify.showNotification("Album art not found.");
            }
        }),
        new Spicetify.ContextMenu.Item("Copy URL", async (uris) => {
            const uri = uris[0];
            const albumArtUrl = await getAlbumArtUrl(uri);
            if (albumArtUrl) {
                await copyUrlToClipboard(albumArtUrl);
            } else {
                Spicetify.showNotification("Album art not found.");
            }
        })
    ], (uris) => {
        const uriObj = Spicetify.URI.from(uris[0]);
        return uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.ALBUM;
    });

    albumArtContextMenu.register();
    console.log("Album art context menu registered.");

    // Create Artist Context Menu
    let artistContextMenu = null;

    function createArtistContextMenu(artistUri, bannerUrl) {
        if (artistContextMenu) {
            artistContextMenu.deregister();
            console.log("Deregistered existing artist context menu.");
        }

        if (!artistUri) {
            console.error("Invalid artist URI provided:", artistUri);
            return;
        }

        const menuItems = [
            new Spicetify.ContextMenu.Item("Open Profile Picture", async () => {
                const artistPicUrl = await getArtistProfilePicture(artistUri);
                if (artistPicUrl) {
                    window.open(artistPicUrl, "_blank");
                } else {
                    Spicetify.showNotification("Artist profile picture not found.");
                }
            }),
            new Spicetify.ContextMenu.Item("Copy Profile Picture URL", async () => {
                const artistPicUrl = await getArtistProfilePicture(artistUri);
                if (artistPicUrl) {
                    await copyUrlToClipboard(artistPicUrl);
                } else {
                    Spicetify.showNotification("Artist profile picture not found.");
                }
            })
        ];

        if (bannerUrl) {
            menuItems.push(
                new Spicetify.ContextMenu.Item("Open Banner Image", () => {
                    window.open(bannerUrl, "_blank");
                }),
                new Spicetify.ContextMenu.Item("Copy Banner Image URL", async () => {
                    await copyUrlToClipboard(bannerUrl);
                })
            );
        }

        artistContextMenu = new Spicetify.ContextMenu.SubMenu("Artist Options", menuItems, (uris) => {
            const uriObj = Spicetify.URI.from(uris[0]);
            return uriObj.type === Spicetify.URI.Type.ARTIST;
        });

        artistContextMenu.register();
        console.log("Artist context menu registered.");
    }

    // Function to deregister the artist context menu
    function deregisterArtistContextMenu() {
        if (artistContextMenu) {
            artistContextMenu.deregister();
            artistContextMenu = null;
            console.log("Artist context menu deregistered.");
        }
    }

    // Function to initialize artist context menu after banner is detected
    function initializeArtistContextMenu(artistUri) {
        const bannerUrl = getArtistBanner();
        createArtistContextMenu(artistUri, bannerUrl);

        if (!bannerUrl) {
            const targetNode = document.querySelector('.main-view-container');
            if (!targetNode) {
                console.error("Target node for observing artist banner not found.");
                return;
            }

            const observer = new MutationObserver(() => {
                const updatedBannerUrl = getArtistBanner();
                if (updatedBannerUrl) {
                    createArtistContextMenu(artistUri, updatedBannerUrl);
                    observer.disconnect();
                }
            });

            observer.observe(targetNode, { childList: true, subtree: true });
            console.log("Observing DOM changes for artist banner...");
        }
    }

    // Detect page changes to adjust context menus
    Spicetify.Platform.History.listen(({ pathname }) => {
        const uri = Spicetify.URI.from(pathname);
        if (uri && uri.type === Spicetify.URI.Type.ARTIST) {
            console.log("Detected artist page:", uri.id);
            initializeArtistContextMenu(pathname);
        } else {
            deregisterArtistContextMenu();
        }
    });

    // Handle initial page load
    const initialPath = window.location.pathname;
    const initialUri = Spicetify.URI.from(initialPath);
    if (initialUri && initialUri.type === Spicetify.URI.Type.ARTIST) {
        console.log("Detected initial artist page:", initialUri.id);
        initializeArtistContextMenu(initialPath);
    }

    // Add context menu to album art image
    function addAlbumArtContextMenu() {
        const albumArtSelector = '.main-nowPlayingBar-container .cover-art-image';
        const albumArtImage = document.querySelector(albumArtSelector);

        if (albumArtImage) {
            if (albumArtImage._albumContextMenuHandler) {
                albumArtImage.removeEventListener('contextmenu', albumArtImage._albumContextMenuHandler);
            }

            albumArtImage._albumContextMenuHandler = async (event) => {
                event.preventDefault();

                const track = Spicetify.Player.data.track;
                if (track) {
                    const albumArtUrl = await getAlbumArtUrl(track.uri);
                    if (albumArtUrl) {
                        const menu = new Spicetify.ContextMenu.SubMenu("", [
                            new Spicetify.ContextMenu.Item("Open Album Art", () => {
                                window.open(albumArtUrl, "_blank");
                            }),
                            new Spicetify.ContextMenu.Item("Copy Album Art URL", async () => {
                                await copyUrlToClipboard(albumArtUrl);
                            })
                        ]);
                        menu.show(event.clientX, event.clientY);
                    } else {
                        Spicetify.showNotification("Album art not found.");
                    }
                }
            };

            albumArtImage.addEventListener('contextmenu', albumArtImage._albumContextMenuHandler);
            console.log("Album art context menu added.");
        } else {
            console.log("Album art image not found.");
        }
    }

    // Function to add context menu to gallery images
    function addGalleryImageContextMenu() {
        const galleryImageSelector = '.main-entityAbout-gallery img';
        const galleryImages = document.querySelectorAll(galleryImageSelector);

        if (galleryImages.length > 0) {
            galleryImages.forEach(img => {
                if (img._galleryContextMenuHandler) {
                    img.removeEventListener('contextmenu', img._galleryContextMenuHandler);
                }

                img._galleryContextMenuHandler = function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const imageUrl = img.src;
                    const menu = new Spicetify.ContextMenu.SubMenu("", [
                        new Spicetify.ContextMenu.Item("Open Image", () => {
                            window.open(imageUrl, "_blank");
                        }),
                        new Spicetify.ContextMenu.Item("Copy Image URL", async () => {
                            await copyUrlToClipboard(imageUrl);
                        })
                    ]);
                    menu.show(event.clientX, event.clientY);
                };

                img.addEventListener('contextmenu', img._galleryContextMenuHandler);
            });
            console.log("Gallery image context menus added.");
        } else {
            console.log("No gallery images found.");
        }
    }

    // Observe for changes in the 'About' section to add gallery image context menus
    function observeAboutSection() {
        const targetNode = document.querySelector('.main-view-container__scroll-node-child');

        if (!targetNode) {
            console.log("Target node for observing 'About' section not found.");
            return;
        }

        const observer = new MutationObserver(() => {
            const isAboutSection = document.querySelector('.main-entityAbout-container');
            if (isAboutSection) {
                addGalleryImageContextMenu();
            }
        });

        observer.observe(targetNode, { childList: true, subtree: true });
        console.log("Observing DOM changes for 'About' section...");
    }

    // Initial setup
    addAlbumArtContextMenu();
    observeAboutSection();

    // Re-add context menu when the album art changes
    Spicetify.Player.addEventListener("songchange", addAlbumArtContextMenu);

})();
