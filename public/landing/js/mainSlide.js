    window.addEventListener('load', function() {
        function createSmoothScroll(selector, direction, speed) {
            const container = document.querySelector(selector);
            if (!container) return;
            const originalHTML = container.innerHTML;
            container.innerHTML = originalHTML + originalHTML;
            let halfHeight = container.scrollHeight / 2;
            let currentPos = (direction === 'down') ? -halfHeight : 0;
            function scroll() {
                if (direction === 'up') {
                    currentPos -= speed;
                    if (Math.abs(currentPos) >= halfHeight) {
                        currentPos = 0;
                    }
                } else if (direction === 'down') {
                    currentPos += speed;
                    if (currentPos >= 0) {
                        currentPos = -halfHeight;
                    }
                }
                container.style.transform = `translateY(${currentPos}px)`;
                requestAnimationFrame(scroll); 
            }
            scroll();
            window.addEventListener('resize', () => {
                halfHeight = container.scrollHeight / 2;
            });
        }
        createSmoothScroll('.mainSlide_01', 'down', 0.5);
        createSmoothScroll('.mainSlide_02', 'up', 0.7); 
        createSmoothScroll('.mainSlide_03', 'down', 0.5);
    
    });