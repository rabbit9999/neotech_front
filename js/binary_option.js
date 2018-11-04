(function(){

    const API_URL = 'http://localhost:8080/';
    let CURRENT_CURRENCY = '';
    let CURRENT_RATE = {};
    let RATE_DATA;
    let UPDATER_TIMER = 0;
    let LAST_UPDATE_TIME = 0;
    let DEPOSIT = 0;



    $('document').ready(function(){
        init();
    });



    function statusRouter(status,data){
        switch (status) {
            case 'LOADING':
                showLoading();
                break;

            case 'READY':
                showBet();
                break;

            case 'WAITING':
                showLoader();
                break;

            case 'RESULT':
                showResult();
                break;
        }
    }

    function updateStatus(){
        request('status',{})
            .then(res=>{
                statusRouter(res.status, res.data);
            })
            .catch(error=>showError(error));
    }


    function init(){

        $('#rate_list').on('change',obj=>{
            CURRENT_CURRENCY = $('#rate_list').val();
            updateSubBetSum();
            renderRatesHistory(RATE_DATA);
        });

        $('#input_bet').on('change',obj=>{
            updateSubBetSum();
        });

        $('#input_bet').on('keyup',obj=>{
            updateSubBetSum();
        });

        $('#agreements').on('change',obj=>{
            updateBetButtonState();
        });

        $('#bet_button').on('click',obj=>{
            doBet();
        });

        $('#after_error_button').on('click',obj=>{
            updateStatus();
        });

        $('#after_fail_button, #after_success_button').on('click',obj=>{
            sendContinue();
        });


        request('rates_data',{})
            .then(res=>{
                renderRateList(res);
                startUpdater();
                updateDeposit();
            })
            .catch(error=>showError(error));
    }

    function showResult(){
        request('result',{})
            .then(res=>{
                console.log(res);
                /*
                btAmoutn = data.btAmount || 0;
        let currencyAmount = data.currencyAmount || 0;
        let currencyCode = data.cur
                 */
                let resultData={
                    btAmount: res.value,
                    currencyAmount: res.currency_value,
                    currencyCode: res.currency
                };
                updateDeposit();
                if(res.success){
                    showSuccess(resultData);
                }
                else{
                    showFail(resultData);
                }
            })
            .catch(error=>showError(error));
    }

    function doBet() {
        let btn = $('#bet_button');
        let chk = $('#agreements');
        let betValue = $('#input_bet').val();
        let betDirection = $('input[name=optradio]:checked').val();

        if(!chk.prop('checked')){
            alert('Прежде, чем делать ставку, ознакомьтесь с правилами сервиса.');
            return false;
        }
        if(!(betValue > 0)){
            alert('Ставка должна быть больше нуля');
            return false;
        }

        if(typeof betDirection === 'undefined'){
            alert('Необходимо выбрать предполагаемое изменение курса BTC');
            return false;
        }

        let betData={
            currency: CURRENT_CURRENCY,
            bet: betDirection,
            bet_value: betValue
        };

        request('do_bet',betData)
            .then(res=>{
                if(res.error !== null){
                    showError(res.error);
                }
                else{
                    updateStatus();
                }
            })
            .catch(error=>showError(error));


    }

    function sendContinue(){
        request('continue',{})
            .then(res=>{
                updateStatus();
            })
            .catch(error=>showError(error));
    }

    function updateDeposit(){
        request('deposit',{})
            .then(res=>{
                DEPOSIT = res;
                $('#current_deposit').html(DEPOSIT / 100000000);
            })
            .catch(error=>showError(error));
    }

    function updateBetButtonState(){
        let btn = $('#bet_button');
        let chk = $('#agreements');
        if(chk.prop('checked')){
            btn.removeClass('disabled');
        }
        else {
            btn.addClass('disabled');
        }
    }

    function updateSubBetSum(){
        let value = $('#input_bet').val();
        $('#bet_in_currency').html(value * CURRENT_RATE[CURRENT_CURRENCY]);
        $('#bet_in_currency_code').html(CURRENT_CURRENCY);
    }

    function startUpdater(){
        updater();
        UPDATER_TIMER = setInterval(updater,15000);
    }

    function updater(){
        request('rates_data',{})
            .then(res=>{
                RATE_DATA = res;
                if(res.last_update_time > LAST_UPDATE_TIME){
                    LAST_UPDATE_TIME = res.last_update_time;
                    renderCurrentRates(res);
                    renderRatesHistory(res);
                }
            })
            .catch(error=>showError(error));

        request('status',{})
            .then(res=>{
                statusRouter(res.status);
            })
            .catch(error=>showError(error));
    }


    //RENDERING
    function renderRateList(data){
        let currentRates = data.current_rates_data || {};
        let rateList = $('#rate_list');
        CURRENT_RATE = currentRates;
        rateList.html('');
        for(let currencyCode in currentRates){
            rateList.append($("<option></option>")
                .attr("value",currencyCode)
                .text(currencyCode));
        }
        CURRENT_CURRENCY = rateList.val();
    }


    function renderRatesHistory(data){
        let history = data.rates_history || [];
        let labels = [];
        let values = [];

        let calibrate  = true;
        let k = 0;
        for(let time in history){
            let date = new Date();
            date.setTime(time);
            let h = date.getHours();
            let m = date.getMinutes();

            if(h<10){
                h = '0' + h;
            }

            if(m<10){
                m = '0' + m;
            }

            if(calibrate){
                calibrate = false;
                k = history[time][CURRENT_CURRENCY];
            }

            labels.push(h + ':' + m);
            values.push((history[time][CURRENT_CURRENCY] - k));
        }

        $('#myChart').remove();
        $('#chart_container').append('<canvas id="myChart" style="max-width: 500px;"></canvas>');

        let ctx = document.getElementById("myChart").getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label:'Дельта курса за последний час',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true
                        }
                    }]
                }
            }
        });

    }


    function renderCurrentRates(data){
        let currentRates = data.current_rates_data || {};
        let currencySymbols = data.currency_symbols || {};

        let currencyRatesContainer = $('#current_rates');
        currencyRatesContainer.html('');
        let isFirst = true;
        for(let currencyCode in currentRates){
            let rate = currentRates[currencyCode] || 0;
            let symbol = currencySymbols[currencyCode] || '';

            if(!isFirst){
                currencyRatesContainer.append('<div class="row"><div class="col-12 rate-field-delimiter"></div></div>');
            }
            isFirst = false;

            currencyRatesContainer.append(`<div class="row">
            <div class="col-2">
                <span class="currency-symbol">${symbol}</span>
            </div>
            <div class="col-10">
                <p class="currency-code">${currencyCode}</p>
                <p class="currency-rate">Курс: ${rate}</p>
            </div>
        </div>`);
        }
    }




    //DATA REQUEST
    function request(method,params){
        return new Promise((done,fail)=>{
            $.ajax({
                url: API_URL + method,
                success: result => {
                    done(result);
                },
                error: error=>{
                    fail(error);
                },
                data:params,
                type: 'POST'
            });
        });
    }







    //INTERFACE
    function showFail(data){
        let btAmoutn = data.btAmount || 0;
        let currencyAmount = data.currencyAmount || 0;
        let currencyCode = data.currencyCode || '';

        hideAll();
        $('#fail_bt_amount').html(btAmoutn);
        $('#fail_currency_amount').html(currencyAmount);
        $('#fail_currency_code').html(currencyCode);
        $('#fail_frame').show();
    }

    function showSuccess(data){
        let btAmoutn = data.btAmount || 0;
        let currencyAmount = data.currencyAmount || 0;
        let currencyCode = data.currencyCode || '';

        hideAll();
        $('#success_bt_amount').html(btAmoutn);
        $('#success_currency_amount').html(currencyAmount);
        $('#success_currency_code').html(currencyCode);
        $('#success_frame').show();
    }

    function showError(errorMessage){
        hideAll();
        $('#error_message').html(errorMessage);
        $('#error_frame').show();
    }

    function showLoading(){
        hideAll();
        $('#loading_frame').show();
    }

    function showLoader(){
        hideAll();
        $('#waiting_frame').show();
    }

    function showBet(){
        hideAll();
        $('#bet_frame').show();
    }

    function hideAll() {
        $('.data-frame').hide();
    }

})();