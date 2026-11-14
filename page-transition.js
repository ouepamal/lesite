(function () {
    const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storageKey = 'page-transition-target';
    const visitKey = 'ouepamal-site-visited';
    const homePath = new URL('index.html', window.location.href).pathname;
    const projectsPath = new URL('projects.html', window.location.href).pathname;
    const socialsPath = new URL('socials.html', window.location.href).pathname;
    let entering = false;
    let leaving = false;
    let pendingPopState = false;
    let shouldShowHomeIntro = false;

    try {
        entering = sessionStorage.getItem(storageKey) === window.location.pathname;
        if (entering) {
            sessionStorage.removeItem(storageKey);
            document.documentElement.classList.add('page-transition-entering');
        }
    } catch (error) {
        console.error('Unable to access session storage for page transitions.', error);
    }

    try {
        const firstVisit = sessionStorage.getItem(visitKey) !== 'true';
        sessionStorage.setItem(visitKey, 'true');
        shouldShowHomeIntro = firstVisit && window.location.pathname === homePath;
    } catch (error) {
        console.error('Unable to determine whether this is the first site visit.', error);
        shouldShowHomeIntro = window.location.pathname === homePath &&
            (!document.referrer || new URL(document.referrer).origin !== window.location.origin);
    }

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'page-transition__content';

        const brand = document.createElement('div');
        brand.className = 'page-transition__brand';

        const logo = document.createElement('img');
        logo.src = 'filesto/mc.png';
        logo.alt = '';

        const name = document.createElement('span');
        name.textContent = '- Ouepamal';
        brand.appendChild(logo);
        brand.appendChild(name);
        content.appendChild(brand);

        const track = document.createElement('div');
        track.className = 'page-transition__track';

        const bar = document.createElement('div');
        bar.className = 'page-transition__bar';
        track.appendChild(bar);
        content.appendChild(track);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        return { overlay: overlay, bar: bar };
    }

    function showHomeIntro() {
        const overlay = document.createElement('div');
        overlay.className = 'home-intro';
        overlay.setAttribute('aria-hidden', 'true');

        const rat = document.createElement('img');
        rat.className = 'home-intro__rat';
        rat.alt = '';
        overlay.appendChild(rat);
        document.body.appendChild(overlay);

        const startedAt = performance.now();
        let pageLoaded = document.readyState === 'complete';
        let ratLoaded = false;
        let dismissed = false;

        function dismissWhenReady() {
            if (!pageLoaded || !ratLoaded || dismissed) {
                return;
            }
            dismissed = true;

            const remaining = Math.max(0, 900 - (performance.now() - startedAt));
            window.setTimeout(function () {
                overlay.classList.add('home-intro--leaving');
                overlay.addEventListener('animationend', function () {
                    document.documentElement.classList.remove('home-intro-active');
                    overlay.remove();
                }, { once: true });
            }, remaining);
        }

        rat.addEventListener('load', function () {
            ratLoaded = true;
            dismissWhenReady();
        }, { once: true });
        rat.addEventListener('error', function (error) {
            console.error('Unable to load the home intro image.', error);
            ratLoaded = true;
            dismissWhenReady();
        }, { once: true });
        window.addEventListener('load', function () {
            pageLoaded = true;
            dismissWhenReady();
        }, { once: true });

        rat.src = 'filesto/rat.jpg';
        if (rat.complete) {
            ratLoaded = true;
            dismissWhenReady();
        }
        dismissWhenReady();
    }

    function loadPage(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) {
                throw new Error('Page request failed with status ' + response.status);
            }
            return response.text();
        }).then(function (html) {
            const nextDocument = new DOMParser().parseFromString(html, 'text/html');
            const nextMain = nextDocument.getElementById('main-container');
            if (!nextMain) {
                throw new Error('The requested page has no main content container.');
            }
            return { main: nextMain, title: nextDocument.title };
        });
    }

    function finishPendingPopState() {
        if (!pendingPopState) {
            return;
        }
        pendingPopState = false;

        if (window.location.pathname !== homePath && window.location.pathname !== projectsPath && window.location.pathname !== socialsPath) {
            window.location.assign(window.location.href);
            return;
        }
        transitionToPage(window.location.href, false);
    }

    function transitionToPage(url, addHistoryEntry) {
        leaving = true;
        const transition = createOverlay();
        transition.overlay.classList.add('page-transition--leaving');
        const progressComplete = new Promise(function (resolve) {
            transition.bar.addEventListener('animationend', resolve, { once: true });
        });

        loadPage(url).then(function (page) {
            return progressComplete.then(function () {
                const currentMain = document.getElementById('main-container');
                if (!currentMain) {
                    throw new Error('The current page has no main content container.');
                }

                currentMain.className = page.main.className;
                currentMain.innerHTML = page.main.innerHTML;
                currentMain.classList.add('show');
                currentMain.scrollTop = 0;
                document.title = page.title;

                if (addHistoryEntry) {
                    window.history.pushState({}, '', url);
                }

                transition.overlay.classList.remove('page-transition--leaving');
                transition.overlay.classList.add('page-transition--entering');
                transition.overlay.addEventListener('animationend', function (event) {
                    if (event.target !== transition.overlay) {
                        return;
                    }
                    transition.overlay.remove();
                    leaving = false;
                    finishPendingPopState();
                }, { once: true });
            });
        }).catch(function (error) {
            console.error('Unable to switch page without reloading.', error);
            try {
                sessionStorage.setItem(storageKey, new URL(url).pathname);
            } catch (storageError) {
                console.error('Unable to save the destination for the page transition.', storageError);
            }
            progressComplete.then(function () {
                window.location.assign(url);
            });
        });
    }

    if (shouldShowHomeIntro) {
        document.documentElement.classList.add('home-intro-active');
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showHomeIntro, { once: true });
        } else {
            showHomeIntro();
        }
    }

    if (reduceMotion) {
        document.documentElement.classList.remove('page-transition-entering');
        return;
    }

    document.addEventListener('click', function (event) {
        if (leaving || event.defaultPrevented || event.button !== 0 || event.metaKey ||
            event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) {
            return;
        }

        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') ||
            (link.target && link.target !== '_self')) {
            return;
        }

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin ||
            (destination.pathname !== homePath && destination.pathname !== projectsPath && destination.pathname !== socialsPath) ||
            destination.pathname === window.location.pathname) {
            return;
        }

        event.preventDefault();
        transitionToPage(destination.href, true);
    });

    window.addEventListener('popstate', function () {
        if (leaving) {
            pendingPopState = true;
            return;
        }

        if (window.location.pathname !== homePath && window.location.pathname !== projectsPath && window.location.pathname !== socialsPath) {
            window.location.assign(window.location.href);
            return;
        }
        transitionToPage(window.location.href, false);
    });

    function showIncomingTransition() {
        const transition = createOverlay();
        transition.overlay.classList.add('page-transition--entering');
        requestAnimationFrame(function () {
            document.documentElement.classList.remove('page-transition-entering');
        });
        transition.overlay.addEventListener('animationend', function () {
            transition.overlay.remove();
        }, { once: true });
    }

    if (entering) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showIncomingTransition, { once: true });
        } else {
            showIncomingTransition();
        }
    }
})();
