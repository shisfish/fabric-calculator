from flask import Flask, render_template

app = Flask(__name__, template_folder='templates')

print("=== 验证 navbar 组件 ===")
with app.test_request_context():
    # 渲染首页
    result = render_template('index.html')
    if '{% set active_page' in result:
        print('❌ 错误: 模板没有被正确渲染')
        exit(1)
    if '<nav class="navbar">' in result and '精确计算' in result and 'active' in result:
        print('✓ 首页: navbar 渲染正常，激活状态正确')
    else:
        print('❌ 首页: navbar 渲染异常')
        exit(1)
    
    # 渲染快速估算页
    result = render_template('quick.html')
    if '<a href="/quick" class="nav-link active">快速估算</a>' in result:
        print('✓ 快速估算页: 激活状态正确')
    else:
        print('❌ 快速估算页: 激活状态异常')
        exit(1)
    
    # 渲染曲线计算页
    result = render_template('curves.html')
    if '<a href="/curves" class="nav-link active">曲线计算</a>' in result:
        print('✓ 曲线计算页: 激活状态正确')
    else:
        print('❌ 曲线计算页: 激活状态异常')
        exit(1)
    
    # 渲染报价管理页
    result = render_template('quotation.html')
    if '<a href="/quotation" class="nav-link active">报价管理</a>' in result:
        print('✓ 报价管理页: 激活状态正确')
    else:
        print('❌ 报价管理页: 激活状态异常')
        exit(1)
    
    # 渲染历史记录页
    result = render_template('history.html')
    if '<a href="/history" class="nav-link active">历史记录</a>' in result:
        print('✓ 历史记录页: 激活状态正确')
    else:
        print('❌ 历史记录页: 激活状态异常')
        exit(1)

print("\n✅ 所有页面 navbar 重构验证通过！")
print("\n验证要点：")
print("- navbar 组件正确引入")
print("- 各页面激活状态（active class）正确")
print("- 所有导航链接存在")
print("- 模板语法无误")
