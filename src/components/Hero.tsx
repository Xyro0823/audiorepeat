"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import Hls from "hls.js";

const MUX_SRC = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";

const Hero = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // hls.js for non-Safari; native HLS (application/vnd.apple.mpegurl) for Safari.
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(MUX_SRC);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_SRC;
    }
  }, []);

  const scrollToLibrary = () => {
    document
      .getElementById("vocab-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openBrowseLibrary = () => {
    window.dispatchEvent(new CustomEvent("audiorepeat:open-browse"));
  };

  return (
    <section className="relative py-32 px-6 md:px-16 lg:px-24 text-center overflow-hidden">
      {/* Background HLS Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 z-[1] pointer-events-none"
        style={{ height: '200px', background: 'linear-gradient(to bottom, black, transparent)' }}
      />
      {/* Bottom fade — blends the video into the vocabulary grid below */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1] pointer-events-none"
        style={{ height: '200px', background: 'linear-gradient(to top, black, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10">
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white tracking-tight leading-[0.85] max-w-3xl mx-auto mb-4">
          Master languages, hands-free.
        </h2>
        <p className="text-white/60 font-body font-light text-sm md:text-base max-w-xl mx-auto mb-8">
          Loop, repeat, and retain vocabulary seamlessly with AI-powered audio drilling in 253
          languages. No pressure, just intuitive learning.
        </p>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={scrollToLibrary}
            className="liquid-glass-strong rounded-full px-6 py-3 text-sm font-medium text-white flex items-center gap-2 hover:bg-white/10 transition-all font-body"
          >
            Start Learning
            <ArrowUpRight className="h-5 w-5" />
          </button>
          <button
            onClick={openBrowseLibrary}
            className="bg-white text-black rounded-full px-6 py-3 text-sm font-medium flex items-center gap-2 hover:bg-white/90 transition-colors font-body"
          >
            Browse Library
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
