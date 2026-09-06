function TapeX(buffer) {

    var data;

    // CHECK INPUT FORMAT
    if (buffer instanceof Uint8Array) {
        data = buffer;
    } else if (buffer instanceof ArrayBuffer) {
        data = new Uint8Array(buffer);
    } else {
        throw new Error("TapeX expects an ArrayBuffer or Uint8Array");
    }

    // STATUS
    var blockReaders = TapeXblockReaders();

    var blocks = [];
    var pos = 0;
    var format = null;
    var version = null;
    var firstBlock = 0;

    /*************************/
    /* IO object for readers */
    /*************************/

    function checkOutOfData(offset) {
        if (offset > data.length) {
            throw new Error("Unexpected end of file");
        }
    }

    function getSize() {
        return data.length;
    }

    function getPos() {
        return pos;
    }

    function setPos(offset) {
        checkOutOfData(offset);
        pos = offset;
    }

    function readByte() {
        checkOutOfData(pos+1);
        return data[pos++];
    }

    function readWord() {
        checkOutOfData(pos+2);
        var value = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        return value;
    }

    function read3Bytes() {
        checkOutOfData(pos+3);
        var value = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
        pos += 3;
        return value;
    }

    function readDWord() {
        checkOutOfData(pos+4);
        var value = data[pos] +
                    data[pos + 1] * 0x100 +
                    data[pos + 2] * 0x10000 +
                    data[pos + 3] * 0x1000000;
        pos += 4;
        return value;
    }

    function readBytes(length) {
        checkOutOfData(pos+length);
        var bytes = data.subarray(pos, pos + length);
        pos += length;
        return bytes;
    }

    function readString(length) {
        checkOutOfData(pos+length);
        var result = "";

        for (var i = 0; i < length; i++) {
            result += String.fromCharCode(readByte());
        }

        return result;
    }

    function peek(pattern) {
        if (typeof pattern === "string") {
            pattern = Array.from(pattern, function(c) {
                return c.charCodeAt(0);
            });
        }

        if (pos + pattern.length > data.length) {
            return false;
        }

        for (var i = 0; i < pattern.length; i++) {
            if (data[pos + i] !== pattern[i]) { return false; }
        }

        return true;
    }

    var io = {
        getSize: getSize,
        getPos: getPos,
        setPos: setPos,
        readByte: readByte,
        readWord: readWord,
        read3Bytes: read3Bytes,
        readDWord: readDWord,
        readBytes: readBytes,
        readString: readString,
        peek: peek
    };

    /************************/
    /* FILE FORMAT CHECKING */
    /************************/

    var casMarker = [0x1F, 0xA6, 0xDE, 0xBA,0xCC, 0x13, 0x7D, 0x74]

    /* Check if the file is a CAS and read it */
    function checkCAS() {
        pos = 0;

        if ( !peek(casMarker) ) { return false; }

        format = "cas";
        version = null;
        firstBlock = 0;
        readCASblocks();

        return true;
    }

    /* Check if the file is a TAP and read it */
    function checkTAP() {
        pos = 0;

        while (pos < data.length) {
            if (pos + 2 > data.length) {
                return false;
            }

            var length = readWord();

            if (pos + length > data.length) {
                return false;
            }

            pos += length;
        }

        if (pos !== data.length) {
            return false;
        }

        format = "tap";
        version = null;
        firstBlock = 0;

        pos = 0;
        readTAPblocks();

        return true;
    }

    /* Check if the file is a TZX and read it */
    function checkTZX() {
        pos = 0;
        if ( !peek("ZXTape!\x1A") ) { return false; }

        format = "tzx";

        pos = 8;
        version = readByte() + "." + readByte();
        firstBlock = pos;
        readTZXblocks();

        return true;
    }

    /* Main checking filetype function */
    function checkFileType() {
        return checkCAS() || checkTAP() || checkTZX();

    }

    /*****************/
    /* BLOCK READING */
    /*****************/

    /* Read a CAS file */
    function readCASblocks() {
        pos = 0;

        var lastHeader = null;
        var decodedBlockIndex = 0;

        while ( (pos + casMarker.length <= data.length)) {

            pos = (Math.ceil(io.getPos() / 8) * 8);
            if (!peek(casMarker)) {
                throw new Error("Malformed CAS file");
            }

            var block;
            var headerType = msxHeaderType(data.subarray(pos+8, pos+24));
            if ( headerType !== null ) {
                block = blockReaders["cas-header"](io, pos);
                block.decodedType = headerType + " header";
                block.filename = String.fromCharCode(...block.data.subarray(10, 16));
                lastHeader = headerType;
                decodedBlockIndex = 0;
            } else {
                var reader = blockReaders["cas-block-" + (lastHeader ? lastHeader.split(" ").pop() : "custom")];
                block = reader(io, pos);
                block.type = "cas-block";
                var blockDecodedType = (lastHeader || "Custom") + " block";
                if ( lastHeader == "MSX ascii" ) {
                    decodedBlockIndex++;
                    blockDecodedType += " " + decodedBlockIndex;
                    if (block.data.includes(0x1A)) {
                        lastHeader = null;
                        decodedBlockIndex = 0;
                    }
                } else {
                    lastHeader = null;
                    decodedBlockIndex = 0;
                }
                block.decodedType = blockDecodedType;
            }

            block.size = pos - block.offset;
            blocks.push(block);
        }
    }

    /* Read a TAP file */
    function readTAPblocks() {
        var tapHeaderMark = [0x13,0x00,0x00];
        var lastHeader = null;

        while (pos < data.length) {
            var isHeader = peek(tapHeaderMark);
            var reader = isHeader
                ? blockReaders["tap-header"]
                : blockReaders["tap-data"];

            var block = reader(io, pos);

            if ( isHeader ) {
                lastHeader = spectrumHeaderTypes[block.headerType] || null;
                if ( lastHeader !== null ) { block.decodedType = lastHeader + " header"; }
            } else if ( lastHeader !== null ) {
                block.decodedType = lastHeader + " block";
                lastHeader = null;
            }

            block.size = pos - block.offset;
            blocks.push(block);
        }
    }

    /* Read a TZX file */
    function readTZXblocks() {

        function isTZXdataBlock(block) {
            return [0x10,0x11,0x14,0x15,0x18,0x19,0x4B].includes(block.id);
        }

        var lastHeader = null;
        var decodedBlockIndex = 0;

        while (pos < data.length) {
            var offset = pos;
            var id = readByte();
            var reader = blockReaders[id];

            if (!reader) {
                throw new Error(
                    "TapeX unsupported block 0x" +
                    id.toString(16).padStart(2, "0").toUpperCase()
                );
            }

            var block = reader(io, offset);
            block.id = id;

            if ( block.data !== undefined ) {
                var headerType = getHeaderBlockType(block.data);
                if ( headerType !== null ) {
                    block.decodedType = headerType + " header";
                    if ( headerType.includes("MSX") ) {
                        block.filename = String.fromCharCode(...block.data.subarray(10, 16));
                    } else if ( headerType.includes("Spectrum") ) {
                        block.filename = String.fromCharCode(...block.data.subarray(2, 12));
                    }
                    lastHeader = headerType;
                    decodedBlockIndex = 0;
                } else if ( lastHeader !== null && isTZXdataBlock(block) ) {
                    decodedBlockIndex ++;
                    block.decodedType = lastHeader + " block" + ((lastHeader == "MSX ascii")?" "+decodedBlockIndex:"");
                    if (lastHeader != "MSX ascii" || block.data.includes(0x1A)) {
                        lastHeader = null;
                        decodedBlockIndex = 0;
                    }
                } else {
                    lastHeader = null;
                    decodedBlockIndex = 0;
                }
            }

            block.size = pos - block.offset;
            blocks.push(block);
        }
    }

    /*************************/
    /* HEADER IDENTIFICATION */
    /*************************/

    function msxHeaderType(data) {
        if ( data.length !== 16 ) { return null; }

        var id = data[0];
        if (id !== 0xD0 && id !== 0xD3 && id !== 0xEA) { return null; }
        for (var i = 1; i < 10; i++) {
            if (data[i] !== id) { return null; }
        }

        switch (id) {
            case 0xD0: return "MSX binary";
            case 0xD3: return "MSX basic";
            case 0xEA: return "MSX ascii";
        }
    }

    var spectrumHeaderTypes = [
        "Spectrum BASIC",
        "Spectrum numeric array",
        "Spectrum character array",
        "Spectrum code"
    ];

    function spectrumHeaderType(data) {
        if (data.length !== 19 || data[0] !== 0x00) { return null; }
        return spectrumHeaderTypes[data[1]] ?? null;
    }

    function getHeaderBlockType(data) {
        var type;

        type = msxHeaderType(data);
        if (type !== null) { return type; }

        type = spectrumHeaderType(data);
        if (type !== null) { return type; }

        return null;
    }

    /**************/
    /* Public API */
    /**************/

    function getBlocks() {
        return blocks;
    }

    function getData(offset, size) {
        return data.subarray(offset, offset + size);
    }

    function getFormat() {
        return format;
    }

    function getHeader() {
        return data.subarray(0, firstBlock);
    }

    function getVersion() {
        return version;
    }

    if ( !checkFileType() ) {
        throw new Error("Tapex file format not recognized!");
    }

    return {
        getBlocks: getBlocks,
        getData: getData,
        getFormat: getFormat,
        getHeader: getHeader,
        getVersion: getVersion
    };
}
