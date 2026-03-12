document.addEventListener('DOMContentLoaded', function() {

    const tabData = [
        { 
            title: "통합 리뷰 관리", 
            desc: "여러 플랫폼의 리뷰를 한 곳에서 편리하게 확인하고 관리하세요.", 
            img: "img/service-001.jpg",
            isComingSoon: false 
        },
        { 
            title: "AI 댓글 생성", 
            desc: "AI가 리뷰 내용과 상황에 맞는 맞춤형 답글을 자동으로 작성해 드립니다.", 
            img: "img/service-002.jpg",
            isComingSoon: false 
        },
        { 
            title: "매장 무제한 관리", 
            desc: "수많은 매장도 제한 없이 한 번에 연동하여 효율적으로 관리할 수 있습니다.", 
            img: "img/service-003.jpg",
            isComingSoon: false 
        },
        { 
            title: "미답변 리뷰 자동 등록", 
            desc: "바쁜 시간에도 놓치는 리뷰가 없도록 AI가 미답변 리뷰에 자동으로 대응합니다.", 
            img: "img/service-004.jpg",
            isComingSoon: false 
        },
        { 
            title: "리뷰 분석 대시보드 (출시예정)", 
            desc: "데이터 기반의 스마트한 리뷰 분석으로 우리 매장의 장단점을 한눈에 파악하세요.", 
            img: "", 
            isComingSoon: true
        },
        { 
            title: "불만족 리뷰 알림 (출시예정)", 
            desc: "부정적인 리뷰가 등록되면 즉각적인 알림을 받아 빠르고 유연한 대처가 가능합니다.", 
            img: "", 
            isComingSoon: true 
        }
    ];

    const tabs = document.querySelectorAll('.serviceTabList');
    const rightBox = document.querySelector('.wf1');
    const displayTit = rightBox.querySelector('.serviceTit');
    const displayTxt = rightBox.querySelector('.serviceTxt');
    const displayImg = document.getElementById('serviceImg');
    const comingSoonBox = document.getElementById('comingSoonBox'); 

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', function() {
            
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            displayTit.innerHTML = tabData[index].title;
            displayTxt.innerHTML = tabData[index].desc;

            if (tabData[index].isComingSoon) {
                displayImg.style.display = 'none';
                comingSoonBox.style.display = 'flex'; 
            } else {
                displayImg.style.display = 'block';
                displayImg.src = tabData[index].img;
                comingSoonBox.style.display = 'none';
            }

            rightBox.classList.remove('fade-action');
            void rightBox.offsetWidth; 
            rightBox.classList.add('fade-action');
            
        });
    });

    if(tabs.length > 0) {
        tabs[0].click(); 
    }
});
