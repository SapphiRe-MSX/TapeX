function TapeXblockReaders() {
    var blockReaders = {};    

    /* CAS READERS */

    // CAS Header Block
    blockReaders["cas-header"] = function(io, offset) {
        io.setPos(offset + 8);
        return {
            type: "cas-header",
            offset: offset,
            data: io.readBytes(16)
        };
    };

    // CAS ASCII Data Block
    blockReaders["cas-block-ascii"] = function(io, offset) {
        io.setPos(offset + 8);
        return {
            offset: offset,
            data: io.readBytes(256)
        };
    };

    // CAS BASIC Data Block
    blockReaders["cas-block-basic"] = function(io, offset) {
        io.setPos(offset + 8);
        var address = 0x8001;

        while (address !== 0) {
            var next = io.readWord();
            if (next !== 0) { io.setPos(io.getPos() + (next - address) - 2); }
            address = next;
        }

        var length = io.getPos() - offset - 8;

        io.setPos(offset + 8);

        return {
            offset: offset,
            data: io.readBytes(length)
        };
    };

    // CAS Binary Data Block
    blockReaders["cas-block-binary"] = function(io, offset) {
        io.setPos(offset + 8);
        var start = io.readWord();
        var end = io.readWord();
        return {
            offset: offset,
            start: start,
            end: end,
            exec: io.readWord(),
            data: io.readBytes(end - start + 1)
        };
    };

    // CAS Custom Data Block
    blockReaders["cas-block-custom"] = function(io, offset) {
        function findNextMarker(io, marker) {
            while (io.getPos() + marker.length <= io.getSize()) {
                if (io.peek(marker)) {
                    return true;
                }

                io.setPos(io.getPos() + 8);
            }

            io.setPos(io.getSize());
            return false;
        }

        io.setPos(offset + 8);

        findNextMarker(io, [0x1F, 0xA6, 0xDE, 0xBA, 0xCC, 0x13, 0x7D, 0x74]);

        var length = io.getPos() - offset - 8;

        io.setPos(offset + 8);

        return {
            offset: offset,
            data: io.readBytes(length)
        };
    };

    /* TAP READERS */

    // TAP Header Block
    blockReaders["tap-header"] = function(io, offset) {
        return {
            type: "tap-header",
            offset: offset,
            length: io.readWord(),
            flag: io.readByte(),
            headerType: io.readByte(),
            filename: io.readString(10),
            dataLength: io.readWord(),
            parameter1: io.readWord(),
            parameter2: io.readWord(),
            checksum: io.readByte()
        };
    };

    // TAP Data Block
    blockReaders["tap-data"] = function(io, offset) {
        var length = io.readWord();
        return {
            type: "tap-data",
            offset: offset,
            length: length,
            flag: io.readByte(),
            data: io.readBytes(length - 2),
            checksum: io.readByte()
        };
    };

    /* TZX READERS */

    // 0x10 Standard Speed Data Block
    blockReaders[0x10] = function(io, offset) {
        var pause = io.readWord();
        var length = io.readWord();
        return {
            type: "standard-speed-data",
            offset: offset,
            pause: pause,
            length: length,
            data: io.readBytes(length)
        };
    };

    // 0x11 Turbo Speed Data Block
    blockReaders[0x11] = function(io, offset) {
        var pilotPulse = io.readWord();
        var sync1Pulse = io.readWord();
        var sync2Pulse = io.readWord();
        var zeroPulse = io.readWord();
        var onePulse = io.readWord();
        var pilotPulses = io.readWord();
        var usedBits = io.readByte();
        var pause = io.readWord();
        var length = io.read3Bytes();
        return {
            type: "turbo-speed-data",
            offset: offset,
            pilotPulse: pilotPulse,
            sync1Pulse: sync1Pulse,
            sync2Pulse: sync2Pulse,
            zeroPulse: zeroPulse,
            onePulse: onePulse,
            pilotPulses: pilotPulses,
            usedBits: usedBits,
            pause: pause,
            length: length,
            data: io.readBytes(length)
        };
    };

    // 0x13 Pulse sequence
    blockReaders[0x13] = function(io, offset) {
        var count = io.readByte();
        var pulses = [];

        for (var i = 0; i < count; i++) {
            pulses.push(io.readWord());
        }

        return {
            type: "pulse-sequence",
            offset: offset,
            count: count,
            pulses: pulses
        };
    };

    // 0x20 Pause (silence) or 'Stop the Tape' command
    blockReaders[0x20] = function(io, offset) {
        return {
            type: "pause-or-stop",
            offset: offset,
            pause: io.readWord()
        };
    };

    // 0x30 Text description
    blockReaders[0x30] = function(io, offset) {
        var length = io.readByte();
        return {
            type: "text-description",
            offset: offset,
            length: length,
            text: io.readString(length)
        };
    };

    // 0x32 Archive info
    var archiveInfoTypes = {
        0x00: "full-title",
        0x01: "publisher",
        0x02: "author",
        0x03: "year",
        0x04: "language",
        0x05: "type",
        0x06: "price",
        0x07: "protection",
        0x08: "origin",
        0xFF: "comment"
    };

    blockReaders[0x32] = function(io, offset) {
        var length = io.readWord();
        var count = io.readByte();
        var entries = [];

        for (var i = 0; i < count; i++) {
            var type = io.readByte();
            var textLength = io.readByte();
            var text = io.readString(textLength);

            entries.push({
                type: type,
                typeName: archiveInfoTypes[type] || "unknown",
                text: text
            });
        }

        return {
            type: "archive-info",
            offset: offset,
            length: length,
            entries: entries
        };
    };

    // 0x35 Custom info block
    blockReaders[0x35] = function(io, offset) {
        var identification = io.readString(16);
        var length = io.readDWord();
        return {
            type: "custom-info",
            offset: offset,
            identification: identification,
            length: length,
            data: io.readBytes(length)
        };
    };

    // 0x4B Kansas City Standard
    blockReaders[0x4B] = function(io, offset) {
        var length = io.readDWord();
        return {
            type: "kansas-city-standard",
            offset: offset,
            length: length,
            pause: io.readWord(),
            pilotPulse: io.readWord(),
            pilotPulses: io.readWord(),
            zeroPulse: io.readWord(),
            onePulse: io.readWord(),
            bitConfig: io.readByte(),
            byteConfig: io.readByte(),
            data: io.readBytes(length - 12)
        };
    };

    return blockReaders;

}

