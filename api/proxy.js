export default async function handler(req, res) {
    const { id, type } = req.query;

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
    }

    // Determine whether the request is for a movie or an episode
    const baseEmbedUrl = type === "episode" 
        ? `https://vidsrc.xyz/embed/tv/${id}`
        : `https://vidsrc.xyz/embed/movie/${id}`;

    try {
        const response = await fetch(baseEmbedUrl);
        let html = await response.text();

        // ✅ Remove intrusive ad scripts but keep player scripts
        html = html.replace(/<script[^>]*(ads|popunder|googletag|analytics|tracking)[^>]*>[\s\S]*?<\/script>/gi, "");

        // ✅ Prevent forced redirects & pop-ups
        html = html.replace(/window\.open/g, "console.log"); 
        html = html.replace(/location\.href/g, "console.log"); 
        html = html.replace(/<a[^>]+target=["']_blank["'][^>]*>/gi, ""); 

        // ✅ Extract main video player iframe
        const match = html.match(/<iframe[^>]+src="([^"]+)"/);
        if (match && match[1]) {
            const embedUrl = match[1];

            return res.status(200).send(`
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { margin: 0; background: black; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        iframe { width: 100%; height: 100vh; border: none; }
                    </style>
                </head>
                <body>
                    <iframe id="vidsrc-frame" src="${embedUrl}" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
                    <script>
                        // ✅ Remove intrusive elements inside the iframe dynamically
                        setInterval(() => {
                            try {
                                const iframe = document.getElementById("vidsrc-frame");
                                if (iframe && iframe.contentWindow) {
                                    const iframeDoc = iframe.contentWindow.document;

                                    // Remove ads, popups, overlays, and hidden elements
                                    iframeDoc.querySelectorAll("a, script[src*='ads'], div[class*='ad'], iframe[src*='ads']").forEach(el => el.remove());
                                }
                            } catch (err) {
                                console.warn("Unable to modify iframe ads:", err);
                            }
                        }, 2000);
                    </script>
                </body>
                </html>
            `);
        } else {
            return res.status(500).json({ error: "Failed to extract video player." });
        }
    } catch (error) {
        return res.status(500).json({ error: "Error fetching video source." });
    }
}
