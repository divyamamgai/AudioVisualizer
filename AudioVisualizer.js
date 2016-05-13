(function (w, wO, d, dO, $) {
    // Declaring Global Enumerations
    w.AudioVisualizerTypes = {
        Bars: 'VisualizerBars',
        Cliffs: 'VisualizerCliffs',
        CliffBalls: 'VisualizerCliffBalls',
        Liquid: 'VisualizerLiquid',
        Circle: 'VisualizerCircle',
        CircleAlpha: 'VisualizerCircleAlpha',
        Square: 'VisualizerSquare',
        SquareAlpha: 'VisualizerSquareAlpha',
        Flower: 'VisualizerFlower',
        FlowerAlpha: 'VisualizerFlowerAlpha',
        RaysOne: 'VisualizerRaysOne',
        RaysTwo: 'VisualizerRaysTwo'
    };
    w.AudioVisualizerDrawMode = {
        Fill: 0,
        Stroke: 1
    };
    // A Round Bit Hack
    function round(number) {
        return (number | 0);
    }

    $.fn.AudioVisualizer = function (options) {
        var ElementObject = this,
            Element = ElementObject[0],
            CanvasContext = Element.getContext('2d'),
            CanvasWidth = Element.width,
            CanvasHeight = Element.height,
            CanvasHalfWidth = CanvasWidth / 2,
            CanvasHalfHeight = CanvasHeight / 2,
            AudioContext = new (w.AudioContext || w.webkitAudioContext)(),
            AudioAnalyser = AudioContext.createAnalyser(),
            Options = $.extend({
                MusicURL: undefined,
                Buffer: undefined,
                VisualizerType: AudioVisualizerTypes.Bars,
                VisualizerDrawMode: AudioVisualizerDrawMode.Fill
            }, options),
            MusicURL = Options.MusicURL,
            Buffer = Options.Buffer,
            VisualizerType = Options.VisualizerType,
            VisualizerDrawMode = Options.VisualizerDrawMode,
            FrequencyBinCount,
            ByteFrequencyData,
            FloatFrequencyData,
            ByteTimeDomainData,
            XMLHttpRequestObject = new XMLHttpRequest(),
            BufferSourceCount = 0,
            BufferSourceArray = {},
            RequestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.mozRequestAnimationFrame,
            CancelAnimationFrame = w.cancelAnimationFrame || w.webkitCancelAnimationFrame || w.mozCancelAnimationFrame,
            VisualizerAnimationID = 0,
            VisualizerBarWidth = 10,
            VisualizerBarsCount = 0,
            VisualizerRayWidth = 5,
            VisualizerRaysCount = 0,
            VisualizerRayRotate = 1.0,
            VisualizerRayTwoMinSize = 100,
        // Limiting the number of frequency data set to be taken under consideration, since the data sets above this
        // index often stay around zero. The limit can be increased up to the FrequencyBinCount.
            VisualizerCliffsCount = 680,
            VisualizerCliffsVerticalSlice = CanvasHalfHeight / 128.0,
            VisualizerCliffsHorizontalSlice = CanvasWidth / VisualizerCliffsCount,
            VisualizerTimeDomainHorizontalSlice = 0,
            TwoPI = Math.PI * 2,
            Functions = {
                InitializeVisualizerVariables: function () {
                    VisualizerBarsCount = CanvasWidth / VisualizerBarWidth;
                    VisualizerRaysCount = CanvasWidth / VisualizerRayWidth;
                    VisualizerRayRotate = TwoPI / VisualizerRaysCount;
                    VisualizerTimeDomainHorizontalSlice = CanvasWidth / FrequencyBinCount;
                },
                LoadMusic: function (callback) {
                    if (MusicURL != undefined) {
                        XMLHttpRequestObject.responseType = 'arraybuffer';
                        XMLHttpRequestObject.open('GET', MusicURL, true);
                        XMLHttpRequestObject.onload = function () {
                            AudioContext.decodeAudioData(XMLHttpRequestObject.response, function (buffer) {
                                Buffer = buffer;
                                FrequencyBinCount = AudioAnalyser.frequencyBinCount;
                                ByteFrequencyData = new Uint8Array(FrequencyBinCount);
                                FloatFrequencyData = new Float32Array(FrequencyBinCount * 4);
                                ByteTimeDomainData = new Uint8Array(FrequencyBinCount);
                                Functions.InitializeVisualizerVariables();
                                callback.apply(this, [Functions]);
                            }, function () {
                                console.error('AudioVisualizer::LoadMusic() : Cannot decode audio data!');
                            });
                        };
                        XMLHttpRequestObject.send();
                    } else {
                        console.error('AudioVisualizer::LoadMusic() : MusicURL is undefined!');
                    }
                },
                /**
                 * @return {number}
                 */
                Start: function () {
                    if (Buffer != undefined) {
                        var BufferSource = AudioContext.createBufferSource();
                        BufferSource.buffer = Buffer;
                        BufferSource.connect(AudioContext.destination);
                        BufferSource.connect(AudioAnalyser);
                        BufferSource.start(0);
                        BufferSourceArray[BufferSourceCount] = BufferSource;
                        return BufferSourceCount++;
                    } else {
                        console.error('AudioVisualizer::Start() : Buffer is undefined!');
                    }
                },
                Stop: function (sourceID) {
                    var BufferSource = BufferSourceArray[sourceID];
                    if (BufferSource != undefined) {
                        BufferSource.stop(0);
                        delete BufferSourceArray[sourceID];
                    } else {
                        console.warn('AudioVisualizer::Stop() : Source ID (' + sourceID + ') doesn\'t exists! ');
                    }
                    return Functions;
                },
                Pause: function (sourceID) {
                    var BufferSource = BufferSourceArray[sourceID];
                    if (BufferSource !== undefined)
                        BufferSource.disconnect();
                    else
                        console.warn('AudioVisualizer::Pause() : Source ID (' + sourceID + ') doesn\'t exists! ');
                    return Functions;
                },
                Play: function (sourceID) {
                    var BufferSource = BufferSourceArray[sourceID];
                    if (BufferSource !== undefined) {
                        BufferSource.connect(AudioContext.destination);
                        BufferSource.connect(AudioAnalyser);
                    } else {
                        console.warn('AudioVisualizer::Play() : Source ID (' + sourceID + ') doesn\'t exists! ');
                    }
                    return Functions;
                },
                ResetColor: function () {
                    CanvasContext.strokeStyle = 'rgb(13, 18, 63)';
                    CanvasContext.fillStyle = 'rgb(13, 18, 63)';
                },
                VisualizerBars: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, X = 0.0, BarHeight;
                    Functions.ResetColor();
                    for (; i < VisualizerBarsCount; i++) {
                        BarHeight = ByteFrequencyData[i] << 1;
                        CanvasContext.beginPath();
                        CanvasContext.rect(X, CanvasHeight - BarHeight, VisualizerBarWidth, BarHeight);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                        X += VisualizerBarWidth + 1;
                    }
                },
                VisualizerCliffs: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, X = 0.0, Y = CanvasHeight;
                    Functions.ResetColor();
                    CanvasContext.beginPath();
                    CanvasContext.moveTo(X, Y);
                    for (; i < VisualizerCliffsCount; i++) {
                        Y = CanvasHeight - ByteFrequencyData[i] * VisualizerCliffsVerticalSlice;
                        CanvasContext.lineTo(X, Y);
                        X += VisualizerCliffsHorizontalSlice;
                    }
                    CanvasContext.lineTo(CanvasWidth, CanvasHeight);
                    CanvasContext.closePath();
                    if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                    else CanvasContext.stroke();
                },
                VisualizerCliffBalls: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, X = 0.0, Y = CanvasHeight;
                    Functions.ResetColor();
                    for (; i < VisualizerCliffsCount; i++) {
                        Y = CanvasHeight - ByteFrequencyData[i] * VisualizerCliffsVerticalSlice;
                        CanvasContext.beginPath();
                        CanvasContext.arc(X, Y, VisualizerCliffsHorizontalSlice, 0, TwoPI, false);
                        CanvasContext.closePath();
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                        X += VisualizerCliffsHorizontalSlice;
                    }
                },
                VisualizerLiquid: function () {
                    AudioAnalyser.getByteTimeDomainData(ByteTimeDomainData);
                    var i = 0, X = 0.0, Y = CanvasHeight;
                    Functions.ResetColor();
                    CanvasContext.beginPath();
                    CanvasContext.moveTo(X, Y);
                    for (; i < FrequencyBinCount; i++) {
                        Y = CanvasHalfHeight - (ByteTimeDomainData[i] - 128);
                        CanvasContext.lineTo(X, Y);
                        X += VisualizerTimeDomainHorizontalSlice;
                    }
                    CanvasContext.lineTo(CanvasWidth, CanvasHalfHeight);
                    CanvasContext.lineTo(CanvasWidth, CanvasHeight);
                    CanvasContext.closePath();
                    if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                    else CanvasContext.stroke();
                },
                VisualizerCircle: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, Color, ColorRatio;
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        ColorRatio = 1.0 - (i / FrequencyBinCount);
                        CanvasContext.beginPath();
                        CanvasContext.arc(0, 0, ByteFrequencyData[i], 0, TwoPI, false);
                        Color = 'rgb(' + round(26 * ColorRatio) + ', ' + round(35 * ColorRatio) + ', ' + round(126 * ColorRatio) + ')';
                        CanvasContext.strokeStyle = Color;
                        CanvasContext.fillStyle = Color;
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerCircleAlpha: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0;
                    Functions.ResetColor();
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        CanvasContext.beginPath();
                        CanvasContext.arc(0, 0, ByteFrequencyData[i], 0, TwoPI, false);
                        CanvasContext.globalAlpha = (i / FrequencyBinCount);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerSquare: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, Color, ColorRatio, Size, HalfSize;
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        Size = ByteFrequencyData[i] << 1;
                        HalfSize = Size / 2;
                        ColorRatio = 1.0 - (i / FrequencyBinCount);
                        CanvasContext.beginPath();
                        CanvasContext.rect(-HalfSize, -HalfSize, Size, Size);
                        Color = 'rgb(' + round(26 * ColorRatio) + ', ' + round(35 * ColorRatio) + ', ' + round(126 * ColorRatio) + ')';
                        CanvasContext.strokeStyle = Color;
                        CanvasContext.fillStyle = Color;
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerSquareAlpha: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, Size, HalfSize;
                    Functions.ResetColor();
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        Size = ByteFrequencyData[i] << 1;
                        HalfSize = Size / 2;
                        CanvasContext.beginPath();
                        CanvasContext.rect(-HalfSize, -HalfSize, Size, Size);
                        CanvasContext.globalAlpha = (i / FrequencyBinCount);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerFlower: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, Color, ColorRatio, Size, HalfSize;
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        Size = ByteFrequencyData[i] << 1;
                        HalfSize = Size / 2;
                        ColorRatio = 1.0 - (i / FrequencyBinCount);
                        CanvasContext.beginPath();
                        CanvasContext.rect(-HalfSize, -HalfSize, Size, Size);
                        CanvasContext.rotate(1);
                        Color = 'rgb(' + round(26 * ColorRatio) + ', ' + round(35 * ColorRatio) + ', ' + round(126 * ColorRatio) + ')';
                        CanvasContext.strokeStyle = Color;
                        CanvasContext.fillStyle = Color;
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerFlowerAlpha: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, Size, HalfSize;
                    Functions.ResetColor();
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < FrequencyBinCount; i++) {
                        Size = ByteFrequencyData[i] << 1;
                        HalfSize = Size / 2;
                        CanvasContext.beginPath();
                        CanvasContext.rect(-HalfSize, -HalfSize, Size, Size);
                        CanvasContext.rotate(1);
                        CanvasContext.globalAlpha = (i / FrequencyBinCount);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerRaysOne: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0;
                    Functions.ResetColor();
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < VisualizerRaysCount; i++) {
                        CanvasContext.beginPath();
                        CanvasContext.rect(0, 0, ByteFrequencyData[i] << 1, VisualizerRayWidth);
                        CanvasContext.rotate(0.5);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerRaysTwo: function () {
                    AudioAnalyser.getByteFrequencyData(ByteFrequencyData);
                    var i = 0, RayHeight;
                    Functions.ResetColor();
                    CanvasContext.save();
                    CanvasContext.translate(CanvasHalfWidth, CanvasHalfHeight);
                    for (; i < VisualizerRaysCount; i++) {
                        CanvasContext.beginPath();
                        RayHeight = ByteFrequencyData[i] << 1;
                        if (RayHeight < VisualizerRayTwoMinSize) RayHeight = VisualizerRayTwoMinSize;
                        CanvasContext.rect(0, 0, RayHeight, VisualizerRayWidth);
                        CanvasContext.rotate(VisualizerRayRotate);
                        if (VisualizerDrawMode === AudioVisualizerDrawMode.Fill) CanvasContext.fill();
                        else CanvasContext.stroke();
                    }
                    CanvasContext.restore();
                },
                VisualizerAnimation: function () {
                    CanvasContext.clearRect(0, 0, CanvasWidth, CanvasHeight);
                    Functions[VisualizerType]();
                    VisualizerAnimationID = RequestAnimationFrame(Functions.VisualizerAnimation);
                },
                StartVisualizer: function () {
                    VisualizerAnimationID = RequestAnimationFrame(Functions.VisualizerAnimation);
                    return Functions;
                },
                StopVisualizer: function () {
                    CancelAnimationFrame(VisualizerAnimationID);
                    return Functions;
                }
            };
        wO
            .on('keydown', function (e) {
                if (e.keyCode === 32) {
                    e.preventDefault();
                    e.stopPropagation();
                    var VisualizerTypeKey, GotCurrentKey = false;
                    for (VisualizerTypeKey in AudioVisualizerTypes) {
                        if (AudioVisualizerTypes.hasOwnProperty(VisualizerTypeKey)) {
                            if (GotCurrentKey) {
                                VisualizerType = AudioVisualizerTypes[VisualizerTypeKey];
                                GotCurrentKey = false;
                            } else {
                                if (AudioVisualizerTypes[VisualizerTypeKey] === VisualizerType) {
                                    GotCurrentKey = true;
                                }
                            }
                        }
                    }
                    if (GotCurrentKey) {
                        VisualizerType = AudioVisualizerTypes.Bars;
                    }
                }
            })
            .on('resize', function () {
                CanvasWidth = w.innerWidth;
                CanvasHeight = w.innerHeight;
                CanvasHalfWidth = CanvasWidth / 2;
                CanvasHalfHeight = CanvasHeight / 2;
                CanvasContext.width = CanvasWidth;
                CanvasContext.height = CanvasHeight;
                // Reinitialize the visualizer variables since we changed the Canvas dimensions.
                Functions.InitializeVisualizerVariables();
            });
        return Functions;
    };
})(window, jQuery(window), document, jQuery(document), jQuery);