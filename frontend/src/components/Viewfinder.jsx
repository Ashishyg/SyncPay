// Camera feed with a centered scan frame. Parent owns the refs and scanning loop.
export default function Viewfinder({ videoRef, canvasRef, scanning = true, children }) {
  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative size-64 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
          {['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'].map(c => (
            <div key={c} className={`absolute size-10 border-white ${c}`} />
          ))}
          {scanning && <div className="animate-scanline absolute inset-x-4 h-0.5 rounded-full bg-primary shadow-[0_0_12px_2px] shadow-primary/60" />}
        </div>
      </div>
      {children}
    </div>
  );
}
