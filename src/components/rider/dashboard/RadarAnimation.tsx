"use client"

import { motion } from "framer-motion"

export function RadarAnimation() {
    return (
        <div className="relative flex items-center justify-center h-64 w-64 md:h-96 md:w-96">
            {/* Core */}
            <div className="absolute h-4 w-4 bg-[#F58220] rounded-full z-10 shadow-[0_0_20px_#F58220]" />

            {/* Ripple 1 */}
            <motion.div
                className="absolute border border-[#F58220]/40 rounded-full h-full w-full"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{
                    opacity: [0, 1, 0],
                    scale: [0.2, 1],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeOut",
                }}
            />

            {/* Ripple 2 */}
            <motion.div
                className="absolute border border-[#F58220]/30 rounded-full h-3/4 w-3/4"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{
                    opacity: [0, 1, 0],
                    scale: [0.2, 1],
                }}
                transition={{
                    duration: 3,
                    delay: 1,
                    repeat: Infinity,
                    ease: "easeOut",
                }}
            />

            {/* Ripple 3 */}
            <motion.div
                className="absolute border border-[#F58220]/20 rounded-full h-1/2 w-1/2"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{
                    opacity: [0, 1, 0],
                    scale: [0.2, 1],
                }}
                transition={{
                    duration: 3,
                    delay: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                }}
            />

            <div className="absolute mt-32 md:mt-48 text-[#F58220] font-medium animate-pulse text-sm md:text-base">
                Scanning for orders...
            </div>
        </div>
    )
}
