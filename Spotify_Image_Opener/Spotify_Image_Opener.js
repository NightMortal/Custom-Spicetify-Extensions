// NAME: Spotify Image Opener
// AUTHOR: NightMortal
// DESCRIPTION: Access album art, artist photos, and more with right-click context menus.
// VERSION: 1.0.0

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

    // Function to add context menu to gallery images with enhanced carousel support
    function addGalleryImageContextMenu() {
        // Multiple selectors to catch all possible gallery images
        const galleryImageSelectors = [
            '.main-entityAbout-gallery img',
            '.main-aboutArtist-container img',
            '.main-aboutArtist-carouselImage img',
            '.main-aboutArtist-carousel img',
            '.artist-artistAbout-carousel img',
            '.artist-artistAbout-carouselImage img'
        ];
        
        // Find all gallery images using our selectors
        let galleryImages = [];
        galleryImageSelectors.forEach(selector => {
            const images = document.querySelectorAll(selector);
            if (images.length > 0) {
                galleryImages = [...galleryImages, ...images];
                console.log(`Found ${images.length} images using selector: ${selector}`);
            }
        });

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
                        }),
                        new Spicetify.ContextMenu.Item("Download Image", () => {
                            const a = document.createElement('a');
                            a.href = imageUrl;
                            a.download = `artist-photo-${Date.now()}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            Spicetify.showNotification("Download started!");
                        })
                    ]);
                    menu.show(event.clientX, event.clientY);
                };

                img.addEventListener('contextmenu', img._galleryContextMenuHandler);
                
                // Make the image have a hover effect to indicate it can be interacted with
                img.style.cursor = 'pointer';
            });
            console.log("Gallery image context menus added to all images.");
        } else {
            console.log("No gallery images found.");
        }
        
        // Add handlers for carousel navigation buttons to re-apply context menus after navigation
        const carouselButtons = document.querySelectorAll('.main-aboutArtist-carouselButton, .artist-artistAbout-carouselButton');
        carouselButtons.forEach(button => {
            if (!button._carouselButtonHandler) {
                button._carouselButtonHandler = () => {
                    // Wait for new images to load
                    setTimeout(addGalleryImageContextMenu, 200);
                };
                button.addEventListener('click', button._carouselButtonHandler);
            }
        });
    }
    
    // Function to add context menu to About Me text
    function addAboutMeTextContextMenu() {
        const aboutTextSelectors = [
            '.main-aboutArtist-content p',
            '.main-entityAbout-content p',
            '.artist-artistAbout-content p',
            '.main-aboutArtist-text',
            '.main-entityAbout-text'
        ];
        
        let aboutTextElements = [];
        aboutTextSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                aboutTextElements = [...aboutTextElements, ...elements];
            }
        });
        
        if (aboutTextElements.length > 0) {
            aboutTextElements.forEach(element => {
                if (element._aboutTextContextMenuHandler) {
                    element.removeEventListener('contextmenu', element._aboutTextContextMenuHandler);
                }
                
                element._aboutTextContextMenuHandler = function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const textContent = element.textContent.trim();
                    const menu = new Spicetify.ContextMenu.SubMenu("", [
                        new Spicetify.ContextMenu.Item("Copy Text", async () => {
                            await copyUrlToClipboard(textContent);
                            Spicetify.showNotification("About Me text copied to clipboard!");
                        })
                    ]);
                    menu.show(event.clientX, event.clientY);
                };
                
                element.addEventListener('contextmenu', element._aboutTextContextMenuHandler);
                element.style.cursor = 'default';
            });
            console.log("About Me text context menus added.");
        } else {
            console.log("No About Me text elements found.");
        }
    }

    // Enhanced observer for About section to handle all dynamic content
    function observeAboutSection() {
        const targetNodes = [
            '.main-view-container__scroll-node-child',
            '.main-view-container',
            '.contentSpacing',
            '.artist-artistOverview-overview',
            '.main-aboutArtist-container'
        ].map(selector => document.querySelector(selector)).filter(Boolean);

        if (targetNodes.length === 0) {
            console.log("Target nodes for observing 'About' section not found.");
            return;
        }

        // Create a single observer to handle all changes
        const observer = new MutationObserver(() => {
            const aboutSectionSelectors = [
                '.main-entityAbout-container',
                '.main-aboutArtist-container',
                '.artist-artistAbout-container'
            ];
            
            // Check if any About section exists
            const isAboutSectionVisible = aboutSectionSelectors.some(
                selector => document.querySelector(selector)
            );
            
            if (isAboutSectionVisible) {
                // Apply context menus to all possible components
                addGalleryImageContextMenu();
                addAboutMeTextContextMenu();
                
                // Look for carousel navigation to enable photo selection
                setupPhotoCarouselInteraction();
            }
        });

        // Apply observers to all found target nodes
        targetNodes.forEach(targetNode => {
            observer.observe(targetNode, { 
                childList: true, 
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        });
        
        console.log("Observing DOM changes for 'About' section with enhanced detection...");
    }
    
    // Function to setup interaction with photo carousel/slideshow
    function setupPhotoCarouselInteraction() {
        const carouselSelectors = [
            '.main-aboutArtist-carousel',
            '.artist-artistAbout-carousel',
            '.main-entityAbout-gallery'
        ];
        
        carouselSelectors.forEach(selector => {
            const carousel = document.querySelector(selector);
            if (carousel) {
                // Look for navigation dots if they exist
                const carouselDots = carousel.querySelectorAll('.main-aboutArtist-carouselDot, .artist-artistAbout-carouselDot');
                if (carouselDots.length > 0) {
                    carouselDots.forEach((dot, index) => {
                        // Add click event to ensure context menu is refreshed after selection
                        if (!dot._dotClickHandler) {
                            dot._dotClickHandler = () => {
                                console.log(`Selecting photo ${index + 1}`);
                                // Re-apply context menus after photo changes
                                setTimeout(addGalleryImageContextMenu, 200);
                            };
                            dot.addEventListener('click', dot._dotClickHandler);
                        }
                    });
                    console.log(`Found ${carouselDots.length} carousel navigation dots.`);
                }
                
                // Look for next/prev buttons
                const navButtons = carousel.querySelectorAll('button');
                navButtons.forEach(button => {
                    if (!button._navButtonHandler) {
                        button._navButtonHandler = () => {
                            setTimeout(addGalleryImageContextMenu, 200);
                        };
                        button.addEventListener('click', button._navButtonHandler);
                    }
                });
            }
        });
    }

    // Enhanced initial setup with the new functionality
    function initialSetup() {
        addAlbumArtContextMenu();
        observeAboutSection();
        
        // Initial check for About section
        const aboutSectionSelectors = [
            '.main-entityAbout-container',
            '.main-aboutArtist-container',
            '.artist-artistAbout-container'
        ];
        
        if (aboutSectionSelectors.some(selector => document.querySelector(selector))) {
            addGalleryImageContextMenu();
            addAboutMeTextContextMenu();
            setupPhotoCarouselInteraction();
        }
    }
    
    // Replace the original initialization with our enhanced version
    initialSetup();

    // Re-add context menu when the album art changes
    Spicetify.Player.addEventListener("songchange", addAlbumArtContextMenu);

    // Additional observer to catch all page changes
    const bodyObserver = new MutationObserver((mutations) => {
        // Look for changes that might indicate new content being loaded
        if (mutations.some(m => m.addedNodes.length > 0 || m.attributeName === 'class')) {
            if (document.querySelector('.artist-artistAbout-container, .main-aboutArtist-container')) {
                initialSetup();
            }
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

})();