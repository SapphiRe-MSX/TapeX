function TapeXblockViewers(container) {

    var previewSize = 64;
    var blockViewers = {};

    initBlockViewers();
    blockBindings();

    /***********/
    /* HELPERS */
    /***********/

    function hex(value, digits) {
        digits = digits || 0;
        return "0x" + value.toString(16).padStart(digits, "0").toUpperCase();
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function isReadableText(data) {
        if (!data.length) {
            return false;
        }

        var readable = 0;

        for (var i = 0; i < data.length; i++) {
            var c = data[i];

            if (
                c === 9 ||
                c === 10 ||
                c === 13 ||
                (c >= 32 && c <= 126)
            ) {
                readable++;
            }
        }

        return readable / data.length > 0.9;
    }

    function bytesToText(data) {
        var text = "";

        for (var i = 0; i < data.length; i++) {
            text += String.fromCharCode(data[i]);
        }

        return text;
    }

    function bytesToHex(data, start, end) {
        var text = "";

        for (var i = start; i < end; i += 16) {
            var hexText = "";
            var asciiText = "";
            var lineLength = Math.min(16, end - i);

            for (var j = 0; j < lineLength; j++) {
                var value = data[i + j];

                if (j > 0) {
                    hexText += " ";
                }

                hexText += value
                    .toString(16)
                    .padStart(2, "0")
                    .toUpperCase();

                asciiText += (value >= 32 && value <= 126)
                    ? String.fromCharCode(value)
                    : ".";
            }

            hexText = hexText.padEnd(16 * 3 - 1, " ");
            text += hexText + "  " + asciiText;

            if (i + 16 < end) {
                text += "\n";
            }
        }

        return text;
    }

    /****************/
    /* INIT VIEWERS */
    /****************/

    function initBlockViewers() {

        /* CAS BLOCK VIEWERS */

        // CAS Header Block
        blockViewers["cas-header"] = function(block) {
            return dataField(block.data);
        };

        // CAS Data Block
        blockViewers["cas-block"] = function(block) {
            var html = '';
            if (block.start !== undefined) {
                html += fieldToHtml("Start", hex(block.start, 4));
                html += fieldToHtml("End", hex(block.end, 4));
                html += fieldToHtml("Exec", hex(block.exec, 4));
            }
            html += dataField(block.data);
            return html;
        };

        /* TAP BLOCK VIEWERS */

        // TAP Header Block
        var tapHeaderTypeNames = {
            0: "Program",
            1: "Number array",
            2: "Character array",
            3: "Code"
        };

        blockViewers["tap-header"] = function(block) {
            var html = '';
            html += fieldToHtml('Type', tapHeaderTypeNames[block.headerType] || "Unknown");
            html += fieldToHtml('Filename', escapeHtml(block.filename));
            html += fieldToHtml('Data length', `${block.dataLength} bytes`);
            html += fieldToHtml('Parameter 1', block.parameter1);
            html += fieldToHtml('Parameter 2', block.parameter2);
            html += fieldToHtml('Checksum', hex(block.checksum, 2));
            return html;
        };

        // TAP Data Block
        blockViewers["tap-data"] = function(block) {
            var html = '';
            html += fieldToHtml('Data length', `${block.data.length} bytes`);
            html += dataField(block.data);
            html += fieldToHtml('Checksum', hex(block.checksum, 2));
            return html;
        };

        /* TZX BLOCK VIEWERS */

        // 0x10 Standard Speed Data Block
        blockViewers["standard-speed-data"] = function(block) {
            var html = '';
            html += fieldToHtml('Pause', `${block.pause} ms`);
            html += fieldToHtml('Data length', `${block.length} bytes`);
            html += dataField(block.data);
            return html;
        };

        // 0x11 Turbo Speed Data Block
        blockViewers["turbo-speed-data"] = function(block) {
            var html = '';
            html += fieldToHtml('Pilot pulse', `${block.pilotPulse} T-states`);
            html += fieldToHtml('Sync 1 pulse', `${block.sync1Pulse} T-states`);
            html += fieldToHtml('Sync 2 pulse', `${block.sync2Pulse} T-states`);
            html += fieldToHtml('Zero pulse', `${block.zeroPulse} T-states`);
            html += fieldToHtml('One pulse', `${block.block.onePulse} T-states`);
            html += fieldToHtml('Pilot pulses', block.pilotPulses);
            html += fieldToHtml('Used bits', block.usedBits);
            html += fieldToHtml('Pause', `${block.pause} ms`);
            html += fieldToHtml('Data length', `${block.length} bytes`);
            html += dataField(block.data);
            return html;
        };

        // 0x13 Pulse sequence
        blockViewers["pulse-sequence"] = function(block) {
            var html = '';
            html += fieldToHtml('Pulses', block.count);
            html += fieldToHtml('Pulse lengths', block.pulses.join(", ") + " T-states");
            return html;
        };

        // 0x20 Pause (silence) or 'Stop the Tape' command
        blockViewers["pause-or-stop"] = function(block) {
            return fieldToHtml('Pause', block.pause === 0 ? "Stop tape" : `${block.pause} ms`);
        };

        // 0x30 Text description
        blockViewers["text-description"] = function(block) {
            return fieldToHtml('Text', escapeHtml(block.text));
        };

        // 0x32 Archive info
        blockViewers["archive-info"] = function(block) {
            var html = '';

            for (var i = 0; i < block.entries.length; i++) {
                html += fieldToHtml(block.entries[i].typeName, escapeHtml(block.entries[i].text));
            }

            return html;
        };

        // 0x35 Custom info block
        blockViewers["custom-info"] = function(block) {
            var content;

            if (isReadableText(block.data)) {
                content = "<pre>" + escapeHtml(bytesToText(block.data)) + "</pre>";
            }
            else {
                content = dataPreview(block.data);
            }

            var html = '';
            html += fieldToHtml('Identification', escapeHtml(block.identification));
            html += fieldToHtml('Data length', `${block.length} bytes`);
            html += fieldToHtml('Data', content);
            return html;
        };

        // 0x4B Kansas City Standard
        blockViewers["kansas-city-standard"] = function(block) {
            var html = '';
            html += fieldToHtml('Pause', `${block.pause} ms`);
            html += fieldToHtml('Pilot pulse', `${block.pilotPulse} T-states`);
            html += fieldToHtml('Pilot pulses', block.pilotPulses);
            html += fieldToHtml('Zero pulse', `${block.zeroPulse} T-states`);
            html += fieldToHtml('One pulse', `${block.block.onePulse} T-states`);
            html += fieldToHtml('Bit config', hex(block.bitConfig, 2));
            html += fieldToHtml('Byte config', hex(block.byteConfig, 2));
            html += fieldToHtml('Data length', `${block.data.length} bytes`);
            html += dataField(block.data);
            return html;
        };
    }

    function blockBindings() {
        /* OPEN / CLOSE BLOCK */
        container.addEventListener("click", function(e) {
            var control = e.target.closest(".tapex-block-controls > *");
            if (control) { return; }

            var header = e.target.closest(".tapex-block-header");

            if (header) {
                header.closest(".tapex-block").classList.toggle("open");
            }
        });

        /* TOGGLE DATA PREVIEW / FULL */
        container.addEventListener("click", function(e) {
            var toggle = e.target.closest(".tapex-data-toggle");

            if (toggle) {
                var field = toggle.closest(".tapex-data-field");
                field.classList.toggle("tapex-data-expanded");
                toggle.textContent =
                    field.classList.contains("tapex-data-expanded")
                        ? "Preview"
                        : "Show all";
            }
        });
    }

    /***********/
    /* RENDERS */
    /***********/

    function dataPreview(data) {
        var previewLength = Math.min(data.length, previewSize);
        var preview = bytesToHex(data, 0, previewLength);

        if (data.length <= previewSize) {
            return "<pre>" + escapeHtml(preview) + "</pre>";
        }

        var full = bytesToHex(data, 0, data.length);

        return `
            <div class="tapex-data-preview">
                <pre>${escapeHtml(preview)}
...</pre>
                </div>
            <div class="tapex-data-full">
                <pre>${escapeHtml(full)}</pre>
            </div>
        `;
    }

    function dataField(data) {
        var button = "";

        if (data.length > previewSize) {
            button = '<button class="tapex-data-toggle">Show all</button>';
        }

        return `
            <div class="tapex-field tapex-data-field">
                <div class="tapex-field-label">
                    <span class="tapex-field-name">Data:</span>
                    ${button}
                </div>
                ${dataPreview(data)}
            </div>
        `;
    }

    function fieldToHtml(name, content) {
        return '<div class="tapex-field"><span class="tapex-field-name">' + name + ':</span> ' + content + '</div>';
    }

    function blockToHtml(block, blockNumber) {
        var viewer = blockViewers[block.type];

        if (viewer === undefined) {
            throw new Error("TapeX Viewers unsupported block type: " + block.type);
        }

        var blockClass = "tapex-block-" +
            (block.id !== undefined
                ? block.id.toString(16).padStart(2, "0").toLowerCase()
                : block.type);

        var html = '<div class="tapex-block ' + blockClass +'">';

        html += '<div class="tapex-block-header">';
        html += '<span class="tapex-block-number">#' + blockNumber + '</span>';
        html += '<span class="tapex-block-title">';
        if (block.id !== undefined) { html += ' · ' + hex(block.id); }
        html += ' · ' + block.type;
        html += ' · offset ' + block.offset;
        html += ' · ' + block.size + ' bytes';
        html += '</span>';
        html += `<span class="tapex-block-decoded-type">${(block.decodedType !== undefined)?block.decodedType:""}</span>`;
        html += `<span class="tapex-block-decoded-type">${(block.filename !== undefined)?"Filename: <code>"+escapeHtml(block.filename)+"</code>":""}</span>`;
        html += `<span class="tapex-block-controls" data-block="${(blockNumber - 1)}"></span>`;
        html += '</div>';

        html += '<div class="tapex-block-body">';
        html += viewer(block);
        html += '</div>';

        html += '</div>';

        return html;
    }

    /**************/
    /* PUBLIC API */
    /**************/

    function render(blocks) {
        var html = "";
        blocks.forEach(function(block, index) {
            html += blockToHtml(block, index + 1);
        });
        container.innerHTML = html;
    }

    function setPreviewSize(size) {
        previewSize = size;
    }

    return {
        render: render,
        setPreviewSize: setPreviewSize
    };

}
