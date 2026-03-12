document.addEventListener('DOMContentLoaded', function() {
    
    const submitBtn = document.querySelector('.submit-btn');
    const previewBox = document.getElementById('previewBox');
    const outputReply = document.getElementById('output_reply');
    
    function getToneValue() {
        var checked = document.querySelector('input[name="tone"]:checked');
        if (!checked) return 'default';
        var id = checked.id;
        if (id === 'tone2') return 'female_2030';
        if (id === 'tone3') return 'male_2030';
        if (id === 'tone4') return 'senior_4050';
        return 'default';
    }
    
    submitBtn.addEventListener('click', function() {
        
        previewBox.classList.remove('preview-hidden');
        previewBox.classList.add('preview-show');
        
        const inputNickname = document.getElementById('input_nickname').value;
        const outputNickname = document.getElementById('output_nickname');
        outputNickname.innerText = inputNickname ? inputNickname : '익명 고객님';
        
        const checkedRateRadio = document.querySelector('input[name="rating"]:checked');
        let rateValue = 5; 
        if (checkedRateRadio) {
            rateValue = parseInt(checkedRateRadio.id.replace('rate', ''), 10); 
        }
        
        const outputStars = document.getElementById('output_stars');
        outputStars.innerHTML = ''; 
        for (var i = 1; i <= 5; i++) {
            if (i <= rateValue) {
                outputStars.innerHTML += '<img src="img/starC.svg" class="wwp20 twp18 mwp16">';
            } else {
                outputStars.innerHTML += '<img src="img/starG.svg" class="wwp20 twp18 mwp16">';
            }
        }

        const inputReview = document.getElementById('input_review').value;
        const outputReview = document.getElementById('output_review');
        
        if (inputReview.trim() !== '') {
            outputReview.innerHTML = inputReview.replace(/\n/g, '<br>');
        } else {
            outputReview.innerHTML = '작성된 리뷰 내용이 없습니다.';
        }
        
        var storeNameEl = document.getElementById('input_store_name');
        var menuEl = document.getElementById('input_menu');
        var storeName = storeNameEl ? storeNameEl.value.trim() : '';
        var menu = menuEl ? menuEl.value.trim() : '';
        
        outputReply.textContent = 'AI 답글 생성 중…';
        submitBtn.disabled = true;
        
        fetch('/api/demo/review-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeName: storeName || undefined,
                rating: rateValue,
                nickname: inputNickname ? inputNickname.trim() : undefined,
                menu: menu || undefined,
                reviewText: inputReview.trim() || '(내용 없음)',
                tone: getToneValue()
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.result && data.result.reply) {
                outputReply.textContent = data.result.reply;
            } else {
                outputReply.textContent = data.detail || '답글 생성에 실패했어요. 다시 시도해 주세요.';
            }
        })
        .catch(function() {
            outputReply.textContent = '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.';
        })
        .finally(function() {
            submitBtn.disabled = false;
        });
        
        if (window.innerWidth <= 768) {
            setTimeout(function() {
                var offset = 150; 
                var elementPosition = previewBox.getBoundingClientRect().top;
                var offsetPosition = elementPosition + window.scrollY - offset;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }, 100);
        }
        
    });
});