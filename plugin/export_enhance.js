class exportEnhancePlugin extends BasePlugin {
    process = () => {
        this.regexp = new RegExp(`<img.*?src="(.*?)".*?>`, "gs");
        this.utils.registerExportHelper("export_enhance", null, this.afterExport);
    }

    afterExport = async (html, writeIdx) => {
        if (!this.config.ENABLE) return html;

        const imageMap = this.config.DOWNLOAD_NETWORK_IMAGE ? await this.downloadAllImage(html, writeIdx) : {};
        const dirname = this.utils.getCurrentDirPath();

        return html.replace(this.regexp, (origin, src, srcIdx) => {
            if (srcIdx < writeIdx) return origin;

            try {
                if (this.utils.isSpecialImage(src)) return origin;

                let imagePath;
                if (this.utils.isNetworkImage(src)) {
                    if (!this.config.DOWNLOAD_NETWORK_IMAGE || !imageMap.hasOwnProperty(src)) return origin;
                    imagePath = imageMap[src];
                } else {
                    imagePath = this.utils.Package.Path.resolve(dirname, src);
                }

                const base64Data = this.toBase64(imagePath);
                return origin.replace(src, base64Data);
            } catch (e) {
                console.error("toBase64 error:", e);
            }
            return origin;
        })
    }

    downloadAllImage = async (html, writeIdx) => {
        const imageMap = {} // map src to localFilePath, use for network image only
        const matches = Array.from(html.matchAll(this.regexp));
        const chunkList = this.utils.chunk(matches, this.config.DOWNLOAD_THREADS);
        for (const list of chunkList) {
            await Promise.all(list.map(async match => {
                if (match.length !== 2
                    || match.index < writeIdx
                    || !this.utils.isNetworkImage(match[1])
                    || imageMap.hasOwnProperty(match[1])
                ) return;

                const src = match[1];
                try {
                    const {ok, filepath} = await this.utils.downloadImage(src);
                    if (ok) {
                        imageMap[src] = filepath;
                    }
                } catch (e) {
                    console.error("download image error:", e);
                }
            }))
        }
        return new Promise(resolve => resolve(imageMap));
    }

    toBase64 = imagePath => {
        const bitmap = this.utils.Package.Fs.readFileSync(imagePath);
        const data = Buffer.from(bitmap).toString('base64');
        return `data:image;base64,${data}`;
    }

    dynamicCallArgsGenerator = () => {
        const call_args = [];
        if (this.config.DOWNLOAD_NETWORK_IMAGE) {
            call_args.push({arg_name: "导出HTML时不下载网络图片", arg_value: "dont_download_network_image"});
        } else {
            call_args.push({arg_name: "导出HTML时下载网络图片", arg_value: "download_network_image"});
        }
        if (this.config.ENABLE) {
            call_args.push({arg_name: "禁用", arg_value: "disable"});
        } else {
            call_args.push({arg_name: "启用", arg_value: "enable"});
        }

        return call_args
    }

    call = type => {
        if (type === "download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = true
        } else if (type === "dont_download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = false
        } else if (type === "disable") {
            this.config.ENABLE = false
        } else if (type === "enable") {
            this.config.ENABLE = true
        }
    }
}

module.exports = {
    plugin: exportEnhancePlugin
};